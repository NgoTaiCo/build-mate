import test from "node:test";
import assert from "node:assert/strict";
import {
  type DomBridgeClient,
  type DomCommand,
  type DomCommandResult,
} from "../src/dom/bridge-client.js";
import { addToBuildHandler } from "../src/tools/add-to-build.js";
import { readCurrentBuildHandler } from "../src/tools/read-current-build.js";
import { revertComponentHandler } from "../src/tools/revert-component.js";

function textOf(result: { content: Array<{ type: string; text?: string }> }): string {
  const first = result.content[0];
  assert.equal(first.type, "text");
  return first.text ?? "";
}

function fakeBridge(result: DomCommandResult) {
  const commands: DomCommand[] = [];
  const client: DomBridgeClient = {
    async execute(command) {
      commands.push(command);
      return result;
    },
  };
  return { client, commands };
}

test("read_current_build sends a semantic read command to the DOM bridge", async () => {
  const { client, commands } = fakeBridge({
    command_id: "cmd-read",
    ok: true,
    snapshot: { status: "ready", components: [], total: 0, revision: "0" },
  });

  const result = await readCurrentBuildHandler({ context_id: "tab-demo" }, client);

  assert.equal(result.isError, false);
  assert.deepEqual(commands, [{ action: "read_build", context_id: "tab-demo" }]);
  assert.equal(JSON.parse(textOf(result)).command_id, "cmd-read");
});

test("add_to_build forwards the exact Catalog identity without selectors", async () => {
  const component = {
    sku: "GPU-001",
    vendor_product_id: "PV-12345",
    name: "Demo GPU",
    category: "gpu" as const,
    quantity: 2,
    filter_labels: ["GeForce RTX 50 series"],
    replace_existing: true,
    product_url: "https://phongvu.vn/demo-gpu",
  };
  const { client, commands } = fakeBridge({ command_id: "cmd-add", ok: true, added: component });

  const result = await addToBuildHandler({ context_id: "tab-demo", component }, client);

  assert.equal(result.isError, false);
  assert.deepEqual(commands, [{ action: "add_component", context_id: "tab-demo", component }]);
  assert.equal(JSON.parse(textOf(result)).added.vendor_product_id, "PV-12345");
  assert.deepEqual(commands[0].component.filter_labels, ["GeForce RTX 50 series"]);
  assert.equal(commands[0].component.replace_existing, true);
  assert.equal(commands[0].component.quantity, 2);
});

test("add_to_build rejects an invalid desired quantity before contacting the bridge", async () => {
  const { client, commands } = fakeBridge({ command_id: "unused", ok: true });
  const result = await addToBuildHandler({
    context_id: "tab-demo",
    component: { sku: "GPU-001", vendor_product_id: "PV-12345", name: "Demo GPU", category: "gpu", quantity: 0 },
  } as never, client);

  assert.equal(result.isError, true);
  assert.equal(commands.length, 0);
});

test("DOM tool rejects malformed component input before contacting the bridge", async () => {
  const { client, commands } = fakeBridge({ command_id: "unused", ok: true });

  const result = await addToBuildHandler(
    {
      context_id: "tab-demo",
      component: { sku: "GPU-001" },
    } as never,
    client,
  );

  assert.equal(result.isError, true);
  assert.equal(commands.length, 0);
});

test("revert_component removes only the exact component at the expected revision", async () => {
  const component = {
    sku: "GPU-001",
    vendor_product_id: "PV-12345",
    name: "Demo GPU",
    category: "gpu" as const,
  };
  const { client, commands } = fakeBridge({ command_id: "cmd-revert", ok: true, removed: component });

  const result = await revertComponentHandler({
    context_id: "tab-demo",
    component,
    expected_revision: "[\"PV-12345\"]",
  }, client);

  assert.equal(result.isError, false);
  assert.deepEqual(commands, [{
    action: "remove_component",
    context_id: "tab-demo",
    component,
    expected_revision: "[\"PV-12345\"]",
  }]);
});
