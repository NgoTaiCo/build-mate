import test from "node:test";
import assert from "node:assert/strict";
import { detectErrors } from "@buildmate/compiler";
import type { Build } from "@buildmate/compiler";
import { detectErrorsHandler } from "../src/tools/detect-errors.js";

function textOf(result: { content: Array<{ type: string; text?: string }> }): string {
  const first = result.content[0];
  assert.equal(first.type, "text");
  return first.text ?? "";
}

test("detect_errors: socket-mismatch build matches direct detectErrors() call, byte-identical", () => {
  const build: Build = {
    components: [
      { type: "cpu", id: "cpu1", socket: "LGA1700" },
      { type: "mainboard", id: "mb1", socket: "AM5" },
    ],
  };
  const result = detectErrorsHandler({ build });
  assert.equal(result.isError, false);
  assert.equal(textOf(result), JSON.stringify(detectErrors(build)));

  const parsed = JSON.parse(textOf(result));
  assert.ok(parsed.some((e: { code: string }) => e.code === "E001"));
});

test("detect_errors: fully compatible build returns an empty array", () => {
  const build: Build = {
    components: [
      { type: "cpu", id: "cpu1", socket: "AM5", ram_gen_supported: ["DDR5"], tdp: 65 },
      {
        type: "mainboard",
        id: "mb1",
        socket: "AM5",
        ram_gen_supported: ["DDR5"],
        form_factor: "ATX",
      },
      { type: "ram", id: "ram1", generation: "DDR5", tdp: 10 },
      { type: "psu", id: "psu1", wattage: 750, form_factor: "ATX" },
      { type: "cooler", id: "cooler1", height: 100 },
      {
        type: "case",
        id: "case1",
        max_cooler_height: 160,
        supported_mb_form_factors: ["ATX"],
        supported_psu_form_factors: ["ATX"],
      },
      { type: "storage", id: "storage1", tdp: 5 },
    ],
  };
  const result = detectErrorsHandler({ build });
  assert.equal(result.isError, false);
  assert.equal(textOf(result), JSON.stringify(detectErrors(build)));
  assert.deepEqual(JSON.parse(textOf(result)), []);
});

test("detect_errors: structurally invalid build returns isError true, does not throw", () => {
  const result = detectErrorsHandler({
    build: { components: "not-an-array" } as unknown as Build,
  });
  assert.equal(result.isError, true);
  assert.ok(textOf(result).length > 0);
});
