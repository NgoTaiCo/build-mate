/**
 * Frontend-facing HTTP server (see contracts/http-chat.md).
 *
 * One relay endpoint `POST /chat` and a `GET /healthz`. No framework — plain
 * `node:http` keeps the shim minimal. Validation runs before any gateway call
 * (FR-007). Error responses never leak secrets (FR-012).
 */
import { createServer, type Server } from 'node:http';
import { ChatRequestSchema, type ErrorCode, type ErrorReply } from './schemas.js';
import { sessionKeyFor, GatewayError, type GatewayClient } from './gateway-client.js';
import type { DomBridge } from './dom-bridge.js';

/** Map a stable error code to its HTTP status (contracts/http-chat.md). */
const STATUS_BY_CODE: Record<ErrorCode, number> = {
  validation_error: 400,
  pairing_required: 425,
  gateway_unavailable: 502,
  auth_failed: 502,
  gateway_error: 502,
  timeout: 504,
};

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

const MAX_BODY_BYTES = 1_000_000; // 1 MB guard against oversized bodies

export function createHttpServer(
  gateway: GatewayClient,
  defaultAgentId: string,
  domBridge?: DomBridge,
): Server {
  return createServer((req, res) => {
    // Permissive CORS for the demo frontend + extension, including preflight (T020).
    for (const [k, v] of Object.entries(CORS_HEADERS)) res.setHeader(k, v);
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const rawUrl = req.url ?? '/';
    const url = new URL(rawUrl, 'http://localhost');

    if (req.method === 'GET' && url.pathname.startsWith('/healthz')) {
      sendJson(res, 200, {
        ok: gateway.state === 'ready',
        gateway: gateway.state,
        deviceId: gateway.deviceId,
        domContexts: domBridge?.contextCount ?? 0,
      });
      return;
    }

    // DOM executor bridge routes (/contexts, /commands, /dom-commands).
    if (domBridge?.tryHandle(req, res, url)) return;

    if (req.method === 'POST' && url.pathname.startsWith('/chat')) {
      handleChat(req, res, gateway, defaultAgentId);
      return;
    }

    sendError(res, 'validation_error', 'Not found');
  });
}

function handleChat(
  req: import('node:http').IncomingMessage,
  res: import('node:http').ServerResponse,
  gateway: GatewayClient,
  defaultAgentId: string,
): void {
  const chunks: Buffer[] = [];
  let size = 0;
  let aborted = false;

  req.on('data', (chunk: Buffer) => {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      aborted = true;
      sendError(res, 'validation_error', 'Request body too large');
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
      sendError(res, 'validation_error', 'Body must be valid JSON');
      return;
    }

    const result = ChatRequestSchema.safeParse(parsed);
    if (!result.success) {
      // No gateway call on validation failure (FR-007).
      sendError(res, 'validation_error', 'message and sessionId are required');
      return;
    }

    const { message, sessionId } = result.data;
    const agentId = result.data.agentId ?? defaultAgentId;
    const sessionKey = sessionKeyFor(sessionId, agentId);

    gateway
      .sendChat({ sessionKey, agentId, message })
      .then((reply) => {
        sendJson(res, 200, { sessionId, reply: reply.reply, runId: reply.runId });
      })
      .catch((err: unknown) => {
        if (err instanceof GatewayError) {
          sendError(res, err.code, err.message);
        } else {
          // Never surface internal detail (FR-012).
          sendError(res, 'gateway_error', 'Lỗi không xác định khi relay tin nhắn.');
        }
      });
  });
}

function sendJson(
  res: import('node:http').ServerResponse,
  status: number,
  body: unknown,
): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function sendError(
  res: import('node:http').ServerResponse,
  code: ErrorCode,
  message: string,
): void {
  const body: ErrorReply = { error: code, message };
  sendJson(res, STATUS_BY_CODE[code], body);
}
