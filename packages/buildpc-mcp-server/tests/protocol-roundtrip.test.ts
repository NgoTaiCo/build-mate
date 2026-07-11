import test from "node:test";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../src/server.js";

const EXPECTED_TOOLS = [
  "add_to_build",
  "compile_build",
  "detect_errors",
  "read_current_build",
  "repair_build",
];

async function connectedClient() {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createServer();
  const client = new Client({ name: "test-client", version: "0.1.0" });
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);
  return { client, server };
}

test("protocol: tools/list returns all BuildMate tools with non-empty input schemas", async () => {
  const { client } = await connectedClient();
  const { tools } = await client.listTools();
  const names = tools.map((t) => t.name).sort();
  assert.deepEqual(names, [...EXPECTED_TOOLS].sort());
  for (const tool of tools) {
    assert.ok(tool.inputSchema, `${tool.name} should advertise an inputSchema`);
    assert.ok(
      Object.keys(tool.inputSchema.properties ?? {}).length > 0,
      `${tool.name}'s inputSchema should have properties`,
    );
  }
});

test("protocol: compile_build is callable via the generic client per its advertised schema", async () => {
  const { client } = await connectedClient();
  const result = await client.callTool({
    name: "compile_build",
    arguments: {
      build: {
        components: [
          { type: "cpu", id: "cpu1", socket: "LGA1700" },
          { type: "mainboard", id: "mb1", socket: "AM5" },
        ],
      },
    },
  });
  assert.equal(result.isError, false);
  const content = result.content as Array<{ type: string; text?: string }>;
  const parsed = JSON.parse(content[0].text ?? "");
  assert.equal(parsed.is_valid, false);
  assert.ok(parsed.errors.some((e: { code: string }) => e.code === "E001"));
});

test("protocol: detect_errors then repair_build is callable via the generic client", async () => {
  const { client } = await connectedClient();
  const build = {
    components: [
      { type: "cpu", id: "cpu1", socket: "LGA1700" },
      { type: "mainboard", id: "mb1", socket: "AM5" },
    ],
  };
  const detectResult = await client.callTool({ name: "detect_errors", arguments: { build } });
  assert.equal(detectResult.isError, false);
  const detectContent = detectResult.content as Array<{ type: string; text?: string }>;
  const errors = JSON.parse(detectContent[0].text ?? "");
  assert.ok(errors.length > 0);

  const repairResult = await client.callTool({
    name: "repair_build",
    arguments: { build, errors },
  });
  assert.equal(repairResult.isError, false);
  const repairContent = repairResult.content as Array<{ type: string; text?: string }>;
  const repairPlan = JSON.parse(repairContent[0].text ?? "");
  assert.equal(repairPlan.length, errors.length);
});

test("protocol: a freshly restarted server (new createServer() call) lists the same tools", async () => {
  const { client } = await connectedClient();
  const { tools } = await client.listTools();
  assert.deepEqual(
    tools.map((t) => t.name).sort(),
    [...EXPECTED_TOOLS].sort(),
  );
});
