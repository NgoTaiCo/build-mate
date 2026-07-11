/**
 * WebSocket client to the OpenClaw gateway.
 *
 * Ports the proven handshake/chat flow from `openclaw-client.html` to Node:
 * protocol 4, V3 Ed25519 device auth, `chat.send` -> broadcast `chat` event.
 * The client owns ONLY the transport connection and a short-lived
 * request<->reply correlation table — no session store, no history, no
 * idempotency layer (Constitution Principle I). Reconnect is transport-only:
 * a dropped socket is re-opened and re-handshaken; sessions are never replayed
 * (OpenClaw owns them).
 */
import { randomUUID } from 'node:crypto';
import WebSocket from 'ws';
import type { BackendConfig } from './config.js';
import {
  seedToKeyPair,
  publicKeyRawBase64url,
  buildV3Payload,
  sign,
  type DeviceKeyPair,
} from './device-auth.js';
import type { ErrorCode } from './schemas.js';

export type GatewayState =
  | 'connecting'
  | 'authenticating'
  | 'ready'
  | 'pairing_required'
  | 'closed';

/** Error carrying a stable FE-facing code (see contracts/http-chat.md). */
export class GatewayError extends Error {
  readonly code: ErrorCode;
  constructor(code: ErrorCode, message: string) {
    super(message);
    this.name = 'GatewayError';
    this.code = code;
  }
}

/** Minimal socket surface so tests can inject a mock (no real `ws`). */
export interface GatewaySocket {
  send(data: string): void;
  close(): void;
  on(event: 'open', cb: () => void): void;
  on(event: 'message', cb: (data: unknown) => void): void;
  on(event: 'close', cb: () => void): void;
  on(event: 'error', cb: (err: Error) => void): void;
}

export type SocketFactory = (url: string) => GatewaySocket;

interface PendingRequest {
  reqId: string;
  runId?: string;
  sessionKey: string;
  resolve: (value: { reply: string; runId: string }) => void;
  reject: (err: GatewayError) => void;
  timer: ReturnType<typeof setTimeout>;
}

const RECONNECT_DELAY_MS = 1000;
const NOISE_EVENTS = new Set(['tick', 'heartbeat', 'presence', 'health']);

/**
 * Map the frontend `sessionId` to an OpenClaw session key (pure, no state).
 * A value already shaped like a full key (contains `:`) is forwarded verbatim;
 * otherwise it is namespaced as `agent:<agentId>:<sessionId>`.
 */
export function sessionKeyFor(sessionId: string, agentId: string): string {
  return sessionId.includes(':') ? sessionId : `agent:${agentId}:${sessionId}`;
}

/** Join the text parts of a gateway `chat` message (string or content[]). */
export function extractChatText(message: unknown): string {
  if (!message || typeof message !== 'object') return '';
  const content = (message as { content?: unknown }).content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter(
        (part): part is { type: string; text: string } =>
          !!part &&
          typeof part === 'object' &&
          (part as { type?: unknown }).type === 'text' &&
          typeof (part as { text?: unknown }).text === 'string',
      )
      .map((part) => part.text)
      .join('\n');
  }
  return '';
}

const defaultSocketFactory: SocketFactory = (url) => {
  // The gateway's Control-UI guard requires an `Origin` header. Browsers send
  // one automatically; the Node `ws` client does not, so derive it from the
  // gateway URL (ws:// -> http://) to satisfy `gateway.controlUi.allowedOrigins`.
  const origin = url.replace(/^ws/, 'http');
  return new WebSocket(url, { origin }) as unknown as GatewaySocket;
};

export class GatewayClient {
  private readonly config: BackendConfig;
  private readonly keyPair: DeviceKeyPair;
  private readonly socketFactory: SocketFactory;

  private socket: GatewaySocket | null = null;
  private _state: GatewayState = 'closed';
  private connectReqId: string | null = null;
  private deviceToken: string | null = null;
  private connId: string | null = null;
  private closedByUser = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly pendingByReqId = new Map<string, PendingRequest>();
  private readonly pendingByRunId = new Map<string, PendingRequest>();

  constructor(
    config: BackendConfig,
    keyPair?: DeviceKeyPair,
    socketFactory: SocketFactory = defaultSocketFactory,
  ) {
    this.config = config;
    this.keyPair = keyPair ?? seedToKeyPair(config.deviceSeed);
    this.socketFactory = socketFactory;
  }

  get state(): GatewayState {
    return this._state;
  }

  get deviceId(): string {
    return this.keyPair.deviceId;
  }

  /** Open the socket and begin the handshake. Safe to call once at boot. */
  connect(): void {
    this.closedByUser = false;
    this.openSocket();
  }

  /** Close permanently (no auto-reconnect). Rejects any in-flight requests. */
  close(): void {
    this.closedByUser = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.rejectAllPending(
      new GatewayError('gateway_unavailable', 'Backend đang tắt kết nối.'),
    );
    this.socket?.close();
    this.socket = null;
    this._state = 'closed';
  }

  private openSocket(): void {
    this._state = 'connecting';
    const socket = this.socketFactory(this.config.gatewayUrl);
    this.socket = socket;
    socket.on('open', () => {
      // Handshake starts when the gateway sends `connect.challenge`.
      this._state = 'authenticating';
    });
    socket.on('message', (data) => this.onMessage(data));
    socket.on('error', () => {
      // `close` will follow; reconnection is handled there.
    });
    socket.on('close', () => this.onClose());
  }

  private onClose(): void {
    // Reject in-flight requests — a dropped socket cannot deliver replies.
    this.rejectAllPending(
      new GatewayError(
        'gateway_unavailable',
        'Mất kết nối tới OpenClaw gateway.',
      ),
    );
    this.socket = null;
    this.deviceToken = null;
    this.connId = null;
    this.connectReqId = null;
    if (this.closedByUser) {
      this._state = 'closed';
      return;
    }
    // Transport-only reconnect (FR-013): re-open and re-handshake, no replay.
    this._state = 'connecting';
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.openSocket();
    }, RECONNECT_DELAY_MS);
  }

  private onMessage(data: unknown): void {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(this.toText(data)) as Record<string, unknown>;
    } catch (err) {
      console.error(
        '[gateway] non-JSON message from gateway:',
        err,
        'raw:',
        this.toText(data).slice(0, 500),
      );
      return; // ignore non-JSON noise
    }

    const type = msg.type;
    if (type === 'event') {
      this.onEvent(msg);
    } else if (type === 'res') {
      this.onRes(msg);
    }
  }

  private onEvent(msg: Record<string, unknown>): void {
    const event = msg.event as string | undefined;
    const payload = (msg.payload ?? {}) as Record<string, unknown>;

    if (event === 'connect.challenge') {
      this.sendConnect(payload);
      return;
    }
    if (event === 'chat') {
      this.onChatEvent(payload);
      return;
    }
    // Ignore noise (tick/heartbeat/presence/health) and everything else.
    if (event && NOISE_EVENTS.has(event)) return;
  }

  private sendConnect(challenge: Record<string, unknown>): void {
    const nonce = String(challenge.nonce ?? '');
    const ts = Number(challenge.ts ?? 0);
    const clientId = 'webchat-ui';
    const clientMode = 'webchat';
    const role = 'operator';
    const scopes = ['operator.read', 'operator.write'];

    const payloadStr = buildV3Payload({
      deviceId: this.keyPair.deviceId,
      clientId,
      clientMode,
      role,
      scopes,
      signedAtMs: ts,
      token: this.config.gatewayToken,
      nonce,
      platform: 'web',
      deviceFamily: 'web',
    });
    const signature = sign(this.keyPair, payloadStr);
    const reqId = `req_${randomUUID()}`;
    this.connectReqId = reqId;

    this.rawSend({
      type: 'req',
      id: reqId,
      method: 'connect',
      params: {
        minProtocol: 4,
        maxProtocol: 4,
        client: {
          id: clientId,
          mode: clientMode,
          version: '1.0.0',
          platform: 'web',
          deviceFamily: 'web',
        },
        role,
        scopes,
        auth: { token: this.config.gatewayToken },
        device: {
          id: this.keyPair.deviceId,
          publicKey: publicKeyRawBase64url(this.keyPair),
          signature,
          signedAt: ts,
          nonce,
        },
      },
    });
  }

  private onRes(msg: Record<string, unknown>): void {
    const id = msg.id as string | undefined;
    const ok = msg.ok === true;
    const payload = (msg.payload ?? {}) as Record<string, unknown>;
    const error = msg.error as
      | { code?: string; message?: string; details?: { code?: string } }
      | undefined;

    // Handshake response.
    if (id && id === this.connectReqId) {
      if (ok && payload.type === 'hello-ok') {
        const auth = (payload.auth ?? {}) as Record<string, unknown>;
        const server = (payload.server ?? {}) as Record<string, unknown>;
        this.deviceToken = (auth.deviceToken as string) ?? null;
        this.connId = (server.connId as string) ?? null;
        this._state = 'ready';
        return;
      }
      this.onConnectError(error);
      return;
    }

    // chat.send acknowledgement — capture the runId for correlation.
    if (id && this.pendingByReqId.has(id)) {
      const pending = this.pendingByReqId.get(id)!;
      if (ok) {
        const runId = payload.runId as string | undefined;
        if (runId) {
          pending.runId = runId;
          this.pendingByRunId.set(runId, pending);
        }
      } else {
        this.settleReject(pending, this.mapResError(error));
      }
    }
  }

  private onConnectError(error?: {
    code?: string;
    message?: string;
    details?: { code?: string };
  }): void {
    const code = error?.details?.code ?? error?.code;
    if (code === 'PAIRING_REQUIRED') {
      // First-boot pairing (T015): surface the deviceId so an operator can
      // approve it, then keep retrying so we reach `ready` after approval
      // without a manual restart.
      this._state = 'pairing_required';
      console.warn(
        `[gateway] device chưa được approve. deviceId=${this.keyPair.deviceId} — ` +
          `chạy: openclaw devices approve <requestId>. Sẽ tự retry sau khi approve.`,
      );
      return;
    }
    // AUTH_TOKEN_MISMATCH / signature / device / protocol errors.
    this._state = 'authenticating';
    console.error(
      `[gateway] handshake failed: ${code ?? 'unknown'} (${error?.message ?? 'no detail'})`,
    );
  }

  private onChatEvent(payload: Record<string, unknown>): void {
    const state = payload.state as string | undefined;
    if (state === 'partial' || state === 'delta') return; // streaming noise

    const runId = payload.runId as string | undefined;
    const sessionKey = payload.sessionKey as string | undefined;
    const pending = this.findPending(runId, sessionKey);
    if (!pending) return; // unrelated to any in-flight request

    if (state === 'error') {
      const text = extractChatText(payload.message);
      this.settleReject(
        pending,
        new GatewayError(
          'gateway_error',
          text || 'OpenClaw báo lỗi khi xử lý tin nhắn.',
        ),
      );
      return;
    }
    if (state === 'final') {
      const reply = extractChatText(payload.message);
      this.settleResolve(pending, {
        reply,
        runId: pending.runId ?? runId ?? '',
      });
    }
  }

  private findPending(
    runId?: string,
    sessionKey?: string,
  ): PendingRequest | undefined {
    if (runId && this.pendingByRunId.has(runId)) {
      return this.pendingByRunId.get(runId);
    }
    if (sessionKey) {
      for (const pending of this.pendingByReqId.values()) {
        if (pending.sessionKey === sessionKey) return pending;
      }
    }
    return undefined;
  }

  /**
   * Send one chat message and await the assistant's final reply.
   * Correlated by the `runId` returned from `chat.send` (fallback sessionKey).
   */
  sendChat(args: {
    sessionKey: string;
    agentId: string;
    message: string;
  }): Promise<{ reply: string; runId: string }> {
    if (this._state === 'pairing_required') {
      return Promise.reject(
        new GatewayError(
          'pairing_required',
          'Device chưa được approve trên gateway. Approve rồi thử lại.',
        ),
      );
    }
    if (this._state !== 'ready' || !this.socket) {
      return Promise.reject(
        new GatewayError(
          'gateway_unavailable',
          'Không kết nối được tới OpenClaw gateway.',
        ),
      );
    }

    const reqId = `req_${randomUUID()}`;
    return new Promise<{ reply: string; runId: string }>((resolve, reject) => {
      const timer = setTimeout(() => {
        const pending = this.pendingByReqId.get(reqId);
        if (pending) {
          this.settleReject(
            pending,
            new GatewayError(
              'timeout',
              'Assistant không phản hồi trong thời gian cho phép.',
            ),
          );
        }
      }, this.config.replyTimeoutMs);

      const pending: PendingRequest = {
        reqId,
        sessionKey: args.sessionKey,
        resolve,
        reject,
        timer,
      };
      this.pendingByReqId.set(reqId, pending);

      this.rawSend({
        type: 'req',
        id: reqId,
        method: 'chat.send',
        params: {
          sessionKey: args.sessionKey,
          agentId: args.agentId,
          message: args.message,
          idempotencyKey: randomUUID(),
        },
      });
    });
  }

  private settleResolve(
    pending: PendingRequest,
    value: { reply: string; runId: string },
  ): void {
    this.evict(pending);
    pending.resolve(value);
  }

  private settleReject(pending: PendingRequest, err: GatewayError): void {
    this.evict(pending);
    pending.reject(err);
  }

  private evict(pending: PendingRequest): void {
    clearTimeout(pending.timer);
    this.pendingByReqId.delete(pending.reqId);
    if (pending.runId) this.pendingByRunId.delete(pending.runId);
  }

  private rejectAllPending(err: GatewayError): void {
    const all = new Set([
      ...this.pendingByReqId.values(),
      ...this.pendingByRunId.values(),
    ]);
    for (const pending of all) {
      clearTimeout(pending.timer);
      pending.reject(err);
    }
    this.pendingByReqId.clear();
    this.pendingByRunId.clear();
  }

  private mapResError(error?: {
    code?: string;
    message?: string;
    details?: { code?: string };
  }): GatewayError {
    const code = error?.details?.code ?? error?.code;
    if (code === 'PAIRING_REQUIRED') {
      return new GatewayError(
        'pairing_required',
        'Device chưa được approve trên gateway. Approve rồi thử lại.',
      );
    }
    return new GatewayError(
      'gateway_error',
      'OpenClaw từ chối tin nhắn. Thử lại sau.',
    );
  }

  private rawSend(obj: unknown): void {
    this.socket?.send(JSON.stringify(obj));
  }

  private toText(data: unknown): string {
    if (typeof data === 'string') return data;
    if (data instanceof Buffer) return data.toString('utf8');
    if (data instanceof ArrayBuffer) return Buffer.from(data).toString('utf8');
    return String(data);
  }
}
