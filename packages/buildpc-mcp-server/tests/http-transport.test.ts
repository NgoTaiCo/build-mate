import test from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { createHttpMcpServer } from "../src/http.js";

async function withServer(
  fn: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const server = createHttpMcpServer();
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const { port } = server.address() as AddressInfo;
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

async function rpc(baseUrl: string, body: unknown): Promise<unknown> {
  const res = await fetch(`${baseUrl}/mcp`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  // Streamable HTTP may answer as SSE ("data: {...}") or plain JSON.
  const line = text
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.startsWith("data:") || l.startsWith("{"));
  const json = line?.startsWith("data:") ? line.slice(5).trim() : line;
  return JSON.parse(json ?? text);
}

test("http: /health returns ok", async () => {
  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { status: "ok" });
  });
});

test("http: initialize + tools/list returns all tools", async () => {
  await withServer(async (baseUrl) => {
    const init = (await rpc(baseUrl, {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "http-test", version: "1.0" },
      },
    })) as { result: { serverInfo: { name: string } } };
    assert.equal(init.result.serverInfo.name, "buildmate-compiler");

    const list = (await rpc(baseUrl, {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
      params: {},
    })) as { result: { tools: Array<{ name: string }> } };
    const names = list.result.tools.map((t) => t.name).sort();
    assert.deepEqual(names, [
      "add_to_build",
      "compile_build",
      "detect_errors",
      "read_current_build",
      "repair_build",
      "search_components",
    ]);
  });
});

test("http: search_components is callable and returns catalog data", async () => {
  await withServer(async (baseUrl) => {
    const call = (await rpc(baseUrl, {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "search_components", arguments: { type: "cpu" } },
    })) as { result: { content: Array<{ text: string }> } };
    const payload = JSON.parse(call.result.content[0].text);
    assert.ok(Array.isArray(payload.components));
    assert.ok(["live", "phongvu", "mock", "mixed"].includes(payload.source));
  });
});
