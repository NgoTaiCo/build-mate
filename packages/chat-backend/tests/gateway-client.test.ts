/**
 * Reply-correlation unit tests (Quality Gate, SC-005). No live gateway: a mock
 * socket lets the test drive the handshake, chat.send ack, and chat events.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  GatewayClient,
  GatewayError,
  sessionKeyFor,
  extractChatText,
  type GatewaySocket,
} from '../src/gateway-client.js';
import type { BackendConfig } from '../src/config.js';

const SEED = Buffer.from(
  '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f',
  'hex',
).toString('base64url');

function makeConfig(overrides: Partial<BackendConfig> = {}): BackendConfig {
  return {
    gatewayUrl: 'ws://mock',
    gatewayToken: 'test-token',
    deviceSeed: SEED,
    httpPort: 8790,
    replyTimeoutMs: 1000,
    defaultAgentId: 'main',
    ...overrides,
  };
}

/** A controllable in-memory socket. The test pushes gateway frames in. */
class MockSocket implements GatewaySocket {
  sent: any[] = [];
  private handlers: Record<string, ((arg?: any) => void)[]> = {};

  send(data: string): void {
    this.sent.push(JSON.parse(data));
  }
  close(): void {
    this.emit('close');
  }
  on(event: string, cb: (arg?: any) => void): void {
    (this.handlers[event] ??= []).push(cb);
  }
  emit(event: string, arg?: any): void {
    for (const cb of this.handlers[event] ?? []) cb(arg);
  }
  /** Deliver a gateway frame to the client. */
  deliver(frame: unknown): void {
    this.emit('message', JSON.stringify(frame));
  }
  lastReq(method: string): any {
    return [...this.sent].reverse().find((m) => m.method === method);
  }
}

/** Connect a client through a mock socket and drive it to `ready`. */
function connectReady(config = makeConfig()): {
  client: GatewayClient;
  socket: MockSocket;
} {
  const socket = new MockSocket();
  const client = new GatewayClient(config, undefined, () => socket);
  client.connect();
  socket.emit('open');
  socket.deliver({
    type: 'event',
    event: 'connect.challenge',
    payload: { nonce: 'nonce-1', ts: 1783763371228 },
  });
  const connectReq = socket.lastReq('connect');
  socket.deliver({
    type: 'res',
    id: connectReq.id,
    ok: true,
    payload: {
      type: 'hello-ok',
      protocol: 4,
      auth: { deviceToken: 'dt' },
      server: { connId: 'c1' },
    },
  });
  assert.equal(client.state, 'ready');
  return { client, socket };
}

test('sessionKeyFor namespaces plain ids and forwards full keys', () => {
  assert.equal(sessionKeyFor('demo-1', 'main'), 'agent:main:demo-1');
  assert.equal(sessionKeyFor('demo-1', 'sales'), 'agent:sales:demo-1');
  assert.equal(sessionKeyFor('agent:main:x', 'main'), 'agent:main:x');
});

test('extractChatText handles string and content[] array', () => {
  assert.equal(extractChatText({ content: 'hello' }), 'hello');
  assert.equal(
    extractChatText({
      content: [
        { type: 'text', text: 'a' },
        { type: 'image', url: 'x' },
        { type: 'text', text: 'b' },
      ],
    }),
    'a\nb',
  );
  assert.equal(extractChatText(undefined), '');
  assert.equal(extractChatText({}), '');
});

test('chat.send ack runId then matching final event resolves the reply', async () => {
  const { client, socket } = connectReady();
  const p = client.sendChat({
    sessionKey: 'agent:main:demo-1',
    agentId: 'main',
    message: 'hi',
  });
  const chatReq = socket.lastReq('chat.send');
  assert.equal(chatReq.params.sessionKey, 'agent:main:demo-1');
  assert.ok(chatReq.params.idempotencyKey, 'idempotencyKey present');

  // Ack with a runId, then the final chat event carrying the same runId.
  socket.deliver({
    type: 'res',
    id: chatReq.id,
    ok: true,
    payload: { runId: 'run-1', status: 'accepted' },
  });
  socket.deliver({
    type: 'event',
    event: 'chat',
    payload: {
      runId: 'run-1',
      sessionKey: 'agent:main:demo-1',
      state: 'final',
      message: { role: 'assistant', content: [{ type: 'text', text: 'yo' }] },
    },
  });

  const result = await p;
  assert.equal(result.reply, 'yo');
  assert.equal(result.runId, 'run-1');
});

test('unrelated runId does not resolve the pending request', async () => {
  const { client, socket } = connectReady(makeConfig({ replyTimeoutMs: 50 }));
  const p = client.sendChat({
    sessionKey: 'agent:main:demo-1',
    agentId: 'main',
    message: 'hi',
  });
  const chatReq = socket.lastReq('chat.send');
  socket.deliver({
    type: 'res',
    id: chatReq.id,
    ok: true,
    payload: { runId: 'run-1' },
  });
  // A final event for a DIFFERENT run must be ignored.
  socket.deliver({
    type: 'event',
    event: 'chat',
    payload: {
      runId: 'run-OTHER',
      sessionKey: 'agent:main:someone-else',
      state: 'final',
      message: { content: 'not for you' },
    },
  });

  await assert.rejects(p, (err: GatewayError) => {
    assert.equal(err.code, 'timeout');
    return true;
  });
});

test('partial/delta chat events are ignored (no premature resolve)', async () => {
  const { client, socket } = connectReady(makeConfig({ replyTimeoutMs: 50 }));
  const p = client.sendChat({
    sessionKey: 'agent:main:demo-1',
    agentId: 'main',
    message: 'hi',
  });
  const chatReq = socket.lastReq('chat.send');
  socket.deliver({
    type: 'res',
    id: chatReq.id,
    ok: true,
    payload: { runId: 'run-1' },
  });
  socket.deliver({
    type: 'event',
    event: 'chat',
    payload: {
      runId: 'run-1',
      state: 'partial',
      message: { content: 'partial...' },
    },
  });
  // Only partial arrived -> must still time out, not resolve with 'partial...'.
  await assert.rejects(p, (err: GatewayError) => err.code === 'timeout');
});

test('chat error event rejects with gateway_error and safe message', async () => {
  const { client, socket } = connectReady();
  const p = client.sendChat({
    sessionKey: 'agent:main:demo-1',
    agentId: 'main',
    message: 'hi',
  });
  const chatReq = socket.lastReq('chat.send');
  socket.deliver({
    type: 'res',
    id: chatReq.id,
    ok: true,
    payload: { runId: 'run-1' },
  });
  socket.deliver({
    type: 'event',
    event: 'chat',
    payload: {
      runId: 'run-1',
      state: 'error',
      message: { content: 'model exploded' },
    },
  });
  await assert.rejects(p, (err: GatewayError) => {
    assert.equal(err.code, 'gateway_error');
    assert.equal(err.message, 'model exploded');
    return true;
  });
});

test('sendChat before ready rejects with gateway_unavailable', async () => {
  const socket = new MockSocket();
  const client = new GatewayClient(makeConfig(), undefined, () => socket);
  client.connect(); // still connecting, no handshake
  await assert.rejects(
    client.sendChat({ sessionKey: 'agent:main:x', agentId: 'main', message: 'hi' }),
    (err: GatewayError) => err.code === 'gateway_unavailable',
  );
});

test('PAIRING_REQUIRED sets state and rejects sendChat with pairing_required', async () => {
  const socket = new MockSocket();
  const client = new GatewayClient(makeConfig(), undefined, () => socket);
  client.connect();
  socket.emit('open');
  socket.deliver({
    type: 'event',
    event: 'connect.challenge',
    payload: { nonce: 'n', ts: 1 },
  });
  const connectReq = socket.lastReq('connect');
  socket.deliver({
    type: 'res',
    id: connectReq.id,
    ok: false,
    error: { code: 'FORBIDDEN', details: { code: 'PAIRING_REQUIRED' } },
  });
  assert.equal(client.state, 'pairing_required');
  await assert.rejects(
    client.sendChat({ sessionKey: 'agent:main:x', agentId: 'main', message: 'hi' }),
    (err: GatewayError) => err.code === 'pairing_required',
  );
});

test('socket close rejects in-flight requests with gateway_unavailable', async () => {
  const { client, socket } = connectReady();
  const p = client.sendChat({
    sessionKey: 'agent:main:demo-1',
    agentId: 'main',
    message: 'hi',
  });
  socket.lastReq('chat.send');
  socket.emit('close');
  await assert.rejects(p, (err: GatewayError) => err.code === 'gateway_unavailable');
  client.close(); // stop the auto-reconnect timer so the test process can exit
});
