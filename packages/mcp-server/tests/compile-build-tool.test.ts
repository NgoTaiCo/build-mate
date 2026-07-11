import test from "node:test";
import assert from "node:assert/strict";
import { compileBuild } from "@buildmate/compiler";
import type { Build } from "@buildmate/compiler";
import { compileBuildHandler } from "../src/tools/compile-build.js";

function textOf(result: { content: Array<{ type: string; text?: string }> }): string {
  const first = result.content[0];
  assert.equal(first.type, "text");
  return first.text ?? "";
}

test("compile_build: socket-mismatch build matches direct compileBuild() call, byte-identical", () => {
  const build: Build = {
    components: [
      { type: "cpu", id: "cpu1", socket: "LGA1700" },
      { type: "mainboard", id: "mb1", socket: "AM5" },
    ],
  };
  const result = compileBuildHandler({ build });
  assert.equal(result.isError, false);
  assert.equal(textOf(result), JSON.stringify(compileBuild(build)));

  const parsed = JSON.parse(textOf(result));
  assert.equal(parsed.is_valid, false);
  assert.ok(parsed.errors.some((e: { code: string }) => e.code === "E001"));
});

test("compile_build: fully compatible build reports zero errors and is_valid true", () => {
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
  const result = compileBuildHandler({ build });
  assert.equal(result.isError, false);
  assert.equal(textOf(result), JSON.stringify(compileBuild(build)));

  const parsed = JSON.parse(textOf(result));
  assert.deepEqual(parsed.errors, []);
  assert.equal(parsed.is_valid, true);
});

test("compile_build: build with multiple issues lists every detected error, matches direct call", () => {
  const build: Build = {
    components: [
      { type: "cpu", id: "cpu1", socket: "LGA1700", ram_gen_supported: ["DDR5"] },
      { type: "mainboard", id: "mb1", socket: "AM5", ram_gen_supported: ["DDR4"] },
      { type: "ram", id: "ram1", generation: "DDR3" },
    ],
  };
  const result = compileBuildHandler({ build });
  assert.equal(result.isError, false);
  assert.equal(textOf(result), JSON.stringify(compileBuild(build)));

  const parsed = JSON.parse(textOf(result));
  assert.ok(parsed.errors.length > 1);
  assert.equal(parsed.is_valid, false);
});

test("compile_build: structurally invalid build returns isError true, does not throw", () => {
  const result = compileBuildHandler({ build: { components: "not-an-array" } as unknown as Build });
  assert.equal(result.isError, true);
  assert.ok(textOf(result).length > 0);
});
