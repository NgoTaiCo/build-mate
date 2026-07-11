/**
 * DOM executor bridge (see docs/dom-executor-bridge-contract.md §3–4).
 *
 * Two sides:
 *   - Extension  <-> bridge over an outbound **WebSocket** (`/dom-bridge`):
 *       extension  -> { type: "dom.register", context_id, page_url }
 *       bridge     -> { type: "dom.command", command_id, command }
 *       extension  -> { type: "dom.result", command_id, ok, snapshot?, ... }
 *   - MCP server -> bridge over HTTP `POST /dom-commands` (unchanged interface;
 *       DomBridgeClient in the MCP server keeps posting the same body).
 *
 * The socket is the live link to one BuildPC tab: `context_id -> socket`. When
 * the socket closes (tab/extension gone) the mapping is dropped immediately, so
 * a command to a dead tab fails fast with CONTEXT_OFFLINE instead of hanging.
 * The bridge owns no OpenClaw session/memory state (Constitution I).
 */
import { WebSocketServer, WebSocket } from 'ws';
import { randomUUID } from 'node:crypto';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import type { Duplex } from 'node:stream';

interface DomCommandResult {
  command_id: string;
  ok: boolean;
  error?: string;
  modal_closed?: boolean;
  snapshot?: unknown;
  added?: unknown;
  removed?: unknown;
}

const VALID_ACTIONS = new Set(['read_build', 'add_component', 'remove_component']);
const MAX_BODY_BYTES = 1_000_000;

export interface DomBridgeOptions {
  /** WebSocket upgrade path the extension connects to. */
  path?: string;
  /** How long POST /dom-commands waits for the extension's dom.result. */
  commandTtlMs?: number;
}

export class DomBridge {
  private readonly wss: WebSocketServer;
  private readonly sockets = new Map<string, WebSocket>(); // context_id -> socket
  private readonly pending = new Map<
    string,
    { resolve: (r: DomCommandResult) => void; timer: NodeJS.Timeout }
  >();
  private readonly path: string;
  private readonly commandTtlMs: number;

  constructor(opts: DomBridgeOptions = {}) {
    this.path = opts.path ?? '/dom-bridge';
    this.commandTtlMs = opts.commandTtlMs ?? 15_000;
    this.wss = new WebSocketServer({ noServer: true });
  }

  /** Registered (live) tab contexts, for /healthz. */
  get contextCount(): number {
    return this.sockets.size;
  }

  /** Route the WebSocket upgrade for our path onto the shared http server. */
  attach(server: Server): void {
    server.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => {
      let pathname: string;
      try {
        pathname = new URL(req.url ?? '/', 'http://localhost').pathname;
      } catch {
        socket.destroy();
        return;
      }
      if (pathname !== this.path) return; // not a bridge socket; leave for others
      this.wss.handleUpgrade(req, socket, head, (ws) => this.onConnection(ws));
    });
  }

  private onConnection(ws: WebSocket): void {
    let contextId: string | null = null;

    ws.on('message', (data) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        return;
      }

      if (msg.type === 'dom.register' && typeof msg.context_id === 'string') {
        contextId = msg.context_id;
        // Last registration wins: drop any stale socket for the same tab.
        const prev = this.sockets.get(contextId);
        if (prev && prev !== ws) prev.close();
        this.sockets.set(contextId, ws);
        ws.send(JSON.stringify({ type: 'dom.registered', context_id: contextId }));
        return;
      }

      if (msg.type === 'dom.result' && typeof msg.command_id === 'string') {
        const p = this.pending.get(msg.command_id);
        if (p) {
          clearTimeout(p.timer);
          this.pending.delete(msg.command_id);
          p.resolve({
            command_id: msg.command_id,
            ok: msg.ok === true,
            error: msg.error as string | undefined,
            modal_closed: msg.modal_closed as boolean | undefined,
            snapshot: msg.snapshot,
            added: msg.added,
            removed: msg.removed,
          });
        }
        return;
      }

      if (msg.type === 'dom.ping') {
        ws.send(JSON.stringify({ type: 'dom.pong' }));
      }
    });

    ws.on('close', () => {
      if (contextId && this.sockets.get(contextId) === ws) {
        this.sockets.delete(contextId);
      }
    });
    ws.on('error', () => {
      /* handled by close */
    });
  }

  /** MCP-facing HTTP route. Returns true if it owns the request. */
  tryHandle(req: IncomingMessage, res: ServerResponse, url: URL): boolean {
    if (req.method === 'POST' && url.pathname === '/dom-commands') {
      this.readJson(req, res, (body) => this.dispatch(res, body));
      return true;
    }
    return false;
  }

  private dispatch(res: ServerResponse, body: Record<string, unknown>): void {
    const action = body.action;
    const contextId = body.context_id;
    if (typeof contextId !== 'string') {
      json(res, 400, { command_id: null, ok: false, error: 'context_id is required' });
      return;
    }
    if (typeof action !== 'string' || !VALID_ACTIONS.has(action)) {
      json(res, 400, { command_id: null, ok: false, error: 'INVALID_ACTION' });
      return;
    }
    const ws = this.sockets.get(contextId);
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      json(res, 200, { command_id: null, ok: false, error: 'CONTEXT_OFFLINE' });
      return;
    }

    const commandId = randomUUID();
    const result = new Promise<DomCommandResult>((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(commandId);
        resolve({ command_id: commandId, ok: false, error: 'VERIFY_TIMEOUT' });
      }, this.commandTtlMs);
      this.pending.set(commandId, {
        resolve: (r) => {
          clearTimeout(timer);
          this.pending.delete(commandId);
          resolve(r);
        },
        timer,
      });
    });

    ws.send(
      JSON.stringify({
        type: 'dom.command',
        command_id: commandId,
        command: {
          action,
          component: body.component,
          expected_revision: body.expected_revision,
        },
      }),
    );

    result.then((r) => json(res, 200, r));
  }

  /** Close all sockets and clear timers so the process can exit cleanly. */
  close(): void {
    for (const { timer } of this.pending.values()) clearTimeout(timer);
    this.pending.clear();
    for (const ws of this.sockets.values()) ws.close();
    this.sockets.clear();
    this.wss.close();
  }

  private readJson(
    req: IncomingMessage,
    res: ServerResponse,
    onBody: (body: Record<string, unknown>) => void,
  ): void {
    const chunks: Buffer[] = [];
    let size = 0;
    let aborted = false;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        aborted = true;
        json(res, 400, { error: 'Request body too large' });
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (aborted) return;
      let parsed: unknown;
      try {
        parsed = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
      } catch {
        json(res, 400, { error: 'Body must be valid JSON' });
        return;
      }
      onBody((parsed ?? {}) as Record<string, unknown>);
    });
  }
}

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}
