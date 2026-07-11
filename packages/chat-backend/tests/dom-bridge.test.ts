import test from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { createServer, type Server } from 'node:http';
import { WebSocket } from 'ws';
import { DomBridge } from '../src/dom-bridge.js';

/** Spin the bridge behind a throwaway http server on an ephemeral port. */
async function withBridge(
  fn: (ctx: { httpBase: string; wsBase: string; bridge: DomBridge }) => Promise<void>,
): Promise<void> {
  const bridge = new DomBridge({ commandTtlMs: 800 });
  const server: Server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (bridge.tryHandle(req, res, url)) return;
    res.writeHead(404);
    res.end();
  });
  bridge.attach(server);
  await new Promise<void>((r) => server.listen(0, r));
  const { port } = server.address() as AddressInfo;
  try {
    await fn({
      httpBase: `http://127.0.0.1:${port}`,
      wsBase: `ws://127.0.0.1:${port}/dom-bridge`,
      bridge,
    });
  } finally {
    bridge.close();
    await new Promise<void>((r) => server.close(() => r()));
  }
}

const post = (base: string, body: unknown) =>
  fetch(`${base}/dom-commands`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }).then((r) => r.json() as Promise<Record<string, unknown>>);

/** Connect a fake extension: register context, run handler for each command. */
function fakeExtension(
  wsBase: string,
  contextId: string,
  onCommand: (cmd: { command_id: string; command: Record<string, unknown> }) => unknown,
): Promise<WebSocket> {
  const ws = new WebSocket(wsBase);
  return new Promise((resolve) => {
    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'dom.register', context_id: contextId, page_url: 'https://phongvu.vn/buildpc' }));
    });
    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'dom.registered') {
        resolve(ws);
        return;
      }
      if (msg.type === 'dom.command') {
        const result = onCommand(msg);
        ws.send(JSON.stringify({ type: 'dom.result', command_id: msg.command_id, ...(result as object) }));
      }
    });
  });
}

test('dom-commands to an unregistered context returns CONTEXT_OFFLINE', async () => {
  await withBridge(async ({ httpBase }) => {
    const body = await post(httpBase, { action: 'read_build', context_id: 'nope' });
    assert.equal(body.ok, false);
    assert.equal(body.error, 'CONTEXT_OFFLINE');
  });
});

test('invalid action is rejected', async () => {
  await withBridge(async ({ httpBase, wsBase }) => {
    const ws = await fakeExtension(wsBase, 'c1', () => ({ ok: true }));
    const res = await fetch(`${httpBase}/dom-commands`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'hack', context_id: 'c1' }),
    });
    assert.equal(res.status, 400);
    assert.equal(((await res.json()) as { error: string }).error, 'INVALID_ACTION');
    ws.close();
  });
});

test('end-to-end: register (ws) -> dispatch -> extension executes -> result', async () => {
  await withBridge(async ({ httpBase, wsBase }) => {
    const snapshot = {
      status: 'ready',
      components: [{ sku: 'CPU-001', vendor_product_id: 'CPU-001', name: 'AMD Ryzen 5 7600', category: 'cpu' }],
      total: 4990000,
      revision: '["CPU-001"]',
    };
    const ws = await fakeExtension(wsBase, 'ctx-1', (msg) => {
      assert.equal(msg.command.action, 'read_build');
      return { ok: true, snapshot };
    });
    const result = await post(httpBase, { action: 'read_build', context_id: 'ctx-1' });
    assert.equal(result.ok, true);
    assert.ok(result.command_id);
    assert.deepEqual(result.snapshot, snapshot);
    ws.close();
  });
});

test('add_component forwards the component and returns added', async () => {
  await withBridge(async ({ httpBase, wsBase }) => {
    const ws = await fakeExtension(wsBase, 'ctx-2', (msg) => {
      assert.equal(msg.command.action, 'add_component');
      assert.equal((msg.command.component as { sku: string }).sku, 's1');
      return { ok: true, added: msg.command.component };
    });
    const result = await post(httpBase, {
      action: 'add_component',
      context_id: 'ctx-2',
      component: { sku: 's1' },
    });
    assert.equal(result.ok, true);
    assert.deepEqual(result.added, { sku: 's1' });
    ws.close();
  });
});

test('socket close drops the context immediately (fast CONTEXT_OFFLINE)', async () => {
  await withBridge(async ({ httpBase, wsBase, bridge }) => {
    const ws = await fakeExtension(wsBase, 'ctx-3', () => ({ ok: true }));
    assert.equal(bridge.contextCount, 1);
    await new Promise<void>((r) => {
      ws.on('close', () => r());
      ws.close();
    });
    // Give the server a tick to process the close event.
    await new Promise((r) => setTimeout(r, 50));
    assert.equal(bridge.contextCount, 0);
    const body = await post(httpBase, { action: 'read_build', context_id: 'ctx-3' });
    assert.equal(body.error, 'CONTEXT_OFFLINE');
  });
});

test('command times out when the extension never replies', async () => {
  await withBridge(async ({ httpBase, wsBase }) => {
    const ws = await fakeExtension(wsBase, 'ctx-4', () => undefined); // never sends a valid result
    // Override: swallow the command without replying.
    ws.removeAllListeners('message');
    ws.on('message', (d) => {
      const m = JSON.parse(d.toString());
      if (m.type === 'dom.registered') return;
      /* ignore dom.command -> force timeout */
    });
    const body = await post(httpBase, { action: 'read_build', context_id: 'ctx-4' });
    assert.equal(body.ok, false);
    assert.equal(body.error, 'VERIFY_TIMEOUT');
    ws.close();
  });
});
