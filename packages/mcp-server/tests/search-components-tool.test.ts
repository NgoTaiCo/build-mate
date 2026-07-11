import test from "node:test";
import assert from "node:assert/strict";
import { searchComponents } from "@buildmate/catalog";
import { searchComponentsHandler } from "../src/tools/search-components.js";

function textOf(result: { content: Array<{ type: string; text?: string }> }): string {
  const first = result.content[0];
  assert.equal(first.type, "text");
  return first.text ?? "";
}

test("search_components: cpu query dispatches to searchComponents(), output matches", async () => {
  const criteria = { type: "cpu" as const };
  const result = await searchComponentsHandler(criteria);
  assert.equal(result.isError, false);
  assert.equal(textOf(result), JSON.stringify(await searchComponents(criteria)));

  const parsed = JSON.parse(textOf(result));
  assert.ok(Array.isArray(parsed.components));
  assert.ok(["live", "mock", "mixed"].includes(parsed.source));
  assert.ok(parsed.components.every((c: { type: string }) => c.type === "cpu"));
});

test("search_components: empty criteria returns catalog result shape without throwing", async () => {
  const result = await searchComponentsHandler({});
  assert.equal(result.isError, false);
  const parsed = JSON.parse(textOf(result));
  assert.ok(Array.isArray(parsed.components));
  assert.ok(Array.isArray(parsed.errors));
});

test("search_components: inverted price range yields no components, no throw", async () => {
  const result = await searchComponentsHandler({ price_min: 999999999, price_max: 1 });
  assert.equal(result.isError, false);
  const parsed = JSON.parse(textOf(result));
  assert.deepEqual(parsed.components, []);
});
