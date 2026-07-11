/**
 * DOM executor bridge (see docs/dom-executor-bridge-contract.md).
 *
 * Relays semantic DOM commands between the MCP server and the BuildPC Chrome
 * extension. The extension speaks HTTP long-poll (matching apps/chrome-extension
 * and tools/dom-bridge-simulator.mjs):
 *
 *   extension  POST /contexts                 register {context_id, page_url}
 *   extension  GET  /commands?context_id=...  long-poll next command
 *   extension  POST /commands/:id/result      deliver the command result
 *   MCP server POST /dom-commands             {action, context_id, component?}
 *
 * The bridge owns no OpenClaw session/memory state (Constitution I): it only
 * maps context_id -> tab connection and correlates command_id -> reply.
 */
import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

interface QueuedCommand {
  command_id: string;
  action: 'read_build' | 'add_component';
  component?: unknown;
}

interface DomContext {
  pageUrl: string;
  queue: QueuedCommand[];
  waiting: ((command: QueuedCommand | null) => void) | null;
  registeredAt: string;
  lastSeenAt: string | null;
}

interface DomCommandResult {
  command_id: string;
  ok: boolean;
  error?: string;
  modal_closed?: boolean;
  snapshot?: unknown;
  added?: unknown;
}

export interface DomBridgeOptions {
  /** How long POST /dom-commands waits for the extension's result. */
  commandTtlMs?: number;
  /** How long GET /commands holds a long-poll open before returning null. */
  longPollMs?: number;
  /** Clock injectable for tests; defaults to Date-based ISO strings. */
  now?: () => string;
}

const MAX_BODY_BYTES = 1_000_000;

export class DomBridge {
  private readonly contexts = new Map<string, DomContext>();
  private readonly pending = new Map<
    string,
    { resolve: (r: DomCommandResult) => void; timer: NodeJS.Timeout }
  >();
  private readonly commandTtlMs: number;
  private readonly longPollMs: number;
  private readonly now: () => string;

  constructor(opts: DomBridgeOptions = {}) {
    this.commandTtlMs = opts.commandTtlMs ?? 15_000;
    this.longPollMs = opts.longPollMs ?? 25_000;
    this.now = opts.now ?? (() => new Date().toISOString());
  }

  /** Number of currently-registered tab contexts (for /healthz). */
  get contextCount(): number {
    return this.contexts.size;
  }

  /**
   * Handle a bridge route. Returns true if the request belonged to the bridge
   * (and a response was/will be sent), false to let the caller keep routing.
   */
  tryHandle(req: IncomingMessage, res: ServerResponse, url: URL): boolean {
    const { method } = req;
    const path = url.pathname;

    if (method === 'POST' && path === '/contexts') {
      this.readJson(req, res, (body) => this.registerContext(res, body));
      return true;
    }
    if (method === 'GET' && path === '/commands') {
      void this.pollCommand(res, url.searchParams.get('context_id') ?? '');
      return true;
    }
    const resultMatch = path.match(/^\/commands\/([^/]+)\/result$/);
    if (method === 'POST' && resultMatch) {
      this.readJson(req, res, (body) =>
        this.deliverResult(res, resultMatch[1], body),
      );
      return true;
    }
    if (method === 'POST' && path === '/dom-commands') {
      this.readJson(req, res, (body) => void this.dispatchCommand(res, body));
      return true;
    }
    return false;
  }

  // --- extension side ---

  private registerContext(res: ServerResponse, body: Record<string, unknown>): void {
    if (typeof body.context_id !== 'string' || typeof body.page_url !== 'string') {
      json(res, 400, { error: 'context_id and page_url are required' });
      return;
    }
    const existing = this.contexts.get(body.context_id);
    const ctx: DomContext = existing ?? {
      pageUrl: body.page_url,
      queue: [],
      waiting: null,
      registeredAt: this.now(),
      lastSeenAt: null,
    };
    ctx.pageUrl = body.page_url;
    this.contexts.set(body.context_id, ctx);
    json(res, 200, { ok: true, context_id: body.context_id });
  }

  private async pollCommand(res: ServerResponse, contextId: string): Promise<void> {
    const ctx = this.contexts.get(contextId);
    if (!ctx) {
      json(res, 404, { error: 'CONTEXT_NOT_CONNECTED' });
      return;
    }
    ctx.lastSeenAt = this.now();
    const command = await this.nextCommand(ctx);
    json(res, 200, { command });
  }

  private nextCommand(ctx: DomContext): Promise<QueuedCommand | null> {
    const queued = ctx.queue.shift();
    if (queued) return Promise.resolve(queued);
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        if (ctx.waiting === deliver) ctx.waiting = null;
        resolve(null);
      }, this.longPollMs);
      const deliver = (command: QueuedCommand | null) => {
        clearTimeout(timer);
        resolve(command);
      };
      ctx.waiting = deliver;
    });
  }

  private deliverResult(
    res: ServerResponse,
    commandId: string,
    body: Record<string, unknown>,
  ): void {
    const pending = this.pending.get(commandId);
    if (!pending) {
      json(res, 404, { error: 'UNKNOWN_COMMAND' });
      return;
    }
    pending.resolve({ command_id: commandId, ok: false, ...body } as DomCommandResult);
    json(res, 200, { ok: true });
  }

  // --- MCP side ---

  private dispatchCommand(res: ServerResponse, body: Record<string, unknown>): void {
    const action = body.action;
    const contextId = body.context_id;
    if (typeof contextId !== 'string') {
      json(res, 400, { command_id: null, ok: false, error: 'context_id is required' });
      return;
    }
    if (action !== 'read_build' && action !== 'add_component') {
      json(res, 400, { command_id: null, ok: false, error: 'INVALID_ACTION' });
      return;
    }
    const ctx = this.contexts.get(contextId);
    if (!ctx) {
      json(res, 200, { command_id: null, ok: false, error: 'CONTEXT_OFFLINE' });
      return;
    }

    const commandId = randomUUID();
    const command: QueuedCommand = {
      command_id: commandId,
      action,
      component: body.component,
    };

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

    // Hand the command to a waiting long-poll, or queue it for the next poll.
    if (ctx.waiting) {
      const deliver = ctx.waiting;
      ctx.waiting = null;
      deliver(command);
    } else {
      ctx.queue.push(command);
    }

    result.then((r) => json(res, 200, r));
  }

  /** Clear timers so the process can exit cleanly. */
  close(): void {
    for (const { timer } of this.pending.values()) clearTimeout(timer);
    this.pending.clear();
    this.contexts.clear();
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
