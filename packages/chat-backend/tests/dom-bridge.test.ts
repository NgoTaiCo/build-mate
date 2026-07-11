import test from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { createServer, type Server } from 'node:http';
import { DomBridge } from '../src/dom-bridge.js';

/** Spin the bridge behind a throwaway http server on an ephemeral port. */
async function withBridge(
  fn: (base: string, bridge: DomBridge) => Promise<void>,
): Promise<void> {
  const bridge = new DomBridge({ commandTtlMs: 1000, longPollMs: 800 });
  const server: Server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (bridge.tryHandle(req, res, url)) return;
    res.writeHead(404);
    res.end();
  });
  await new Promise<void>((r) => server.listen(0, r));
  const { port } = server.address() as AddressInfo;
  try {
    await fn(`http://127.0.0.1:${port}`, bridge);
  } finally {
    bridge.close();
    await new Promise<void>((r) => server.close(() => r()));
  }
}

const post = (base: string, path: string, body: unknown) =>
  fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

test('dom-commands to an unregistered context returns CONTEXT_OFFLINE', async () => {
  await withBridge(async (base) => {
    const res = await post(base, '/dom-commands', {
      action: 'read_build',
      context_id: 'nope',
    });
    const body = (await res.json()) as { ok: boolean; error: string };
    assert.equal(body.ok, false);
    assert.equal(body.error, 'CONTEXT_OFFLINE');
  });
});

test('invalid action is rejected', async () => {
  await withBridge(async (base) => {
    await post(base, '/contexts', { context_id: 'c1', page_url: 'https://x/buildpc' });
    const res = await post(base, '/dom-commands', { action: 'hack', context_id: 'c1' });
    assert.equal(res.status, 400);
    const body = (await res.json()) as { error: string };
    assert.equal(body.error, 'INVALID_ACTION');
  });
});

test('end-to-end: register -> dispatch -> extension polls -> posts result', async () => {
  await withBridge(async (base) => {
    await post(base, '/contexts', {
      context_id: 'ctx-1',
      page_url: 'https://phongvu.vn/buildpc',
    });

    // MCP dispatches a command (resolves once the extension posts its result).
    const commandDone = post(base, '/dom-commands', {
      action: 'read_build',
      context_id: 'ctx-1',
    }).then((r) => r.json() as Promise<Record<string, unknown>>);

    // Extension long-polls for the next command.
    const poll = await fetch(`${base}/commands?context_id=ctx-1`);
    const { command } = (await poll.json()) as {
      command: { command_id: string; action: string };
    };
    assert.equal(command.action, 'read_build');

    // Extension executes and posts the DOM snapshot back.
    const snapshot = { status: 'ready', components: [], total: 0, revision: 'r1' };
    await post(base, `/commands/${command.command_id}/result`, { ok: true, snapshot });

    const result = await commandDone;
    assert.equal(result.ok, true);
    assert.equal(result.command_id, command.command_id);
    assert.deepEqual(result.snapshot, snapshot);
  });
});

test('queued command is delivered on a later poll', async () => {
  await withBridge(async (base) => {
    await post(base, '/contexts', { context_id: 'ctx-2', page_url: 'https://phongvu.vn/buildpc' });
    // Dispatch first (no poller waiting yet) -> queued.
    const commandDone = post(base, '/dom-commands', {
      action: 'add_component',
      context_id: 'ctx-2',
      component: { sku: 's1' },
    }).then((r) => r.json() as Promise<Record<string, unknown>>);

    const poll = await fetch(`${base}/commands?context_id=ctx-2`);
    const { command } = (await poll.json()) as { command: { command_id: string } };
    await post(base, `/commands/${command.command_id}/result`, { ok: true, added: { sku: 's1' } });

    const result = await commandDone;
    assert.equal(result.ok, true);
    assert.deepEqual(result.added, { sku: 's1' });
  });
});

test('command times out when the extension never replies', async () => {
  await withBridge(async (base) => {
    await post(base, '/contexts', { context_id: 'ctx-3', page_url: 'https://phongvu.vn/buildpc' });
    const res = await post(base, '/dom-commands', { action: 'read_build', context_id: 'ctx-3' });
    const body = (await res.json()) as { ok: boolean; error: string };
    assert.equal(body.ok, false);
    assert.equal(body.error, 'VERIFY_TIMEOUT');
  });
});
