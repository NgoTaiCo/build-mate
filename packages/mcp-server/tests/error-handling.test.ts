import test from "node:test";
import assert from "node:assert/strict";
import type { Build, CompilerError } from "@buildmate/compiler";
import { compileBuildHandler } from "../src/tools/compile-build.js";
import { detectErrorsHandler } from "../src/tools/detect-errors.js";
import { repairBuildHandler } from "../src/tools/repair-build.js";

function textOf(result: { content: Array<{ type: string; text?: string }> }): string {
  const first = result.content[0];
  assert.equal(first.type, "text");
  return first.text ?? "";
}

const NOT_AN_OBJECT = "not-an-object" as unknown as Build;
const COMPONENTS_NOT_ARRAY = { components: "not-an-array" } as unknown as Build;

test("compile_build: non-object build returns isError true, no throw", () => {
  const result = compileBuildHandler({ build: NOT_AN_OBJECT });
  assert.equal(result.isError, true);
  assert.ok(textOf(result).length > 0);
});

test("compile_build: components not an array returns isError true, no throw", () => {
  const result = compileBuildHandler({ build: COMPONENTS_NOT_ARRAY });
  assert.equal(result.isError, true);
  assert.ok(textOf(result).length > 0);
});

test("detect_errors: non-object build returns isError true, no throw", () => {
  const result = detectErrorsHandler({ build: NOT_AN_OBJECT });
  assert.equal(result.isError, true);
  assert.ok(textOf(result).length > 0);
});

test("detect_errors: components not an array returns isError true, no throw", () => {
  const result = detectErrorsHandler({ build: COMPONENTS_NOT_ARRAY });
  assert.equal(result.isError, true);
  assert.ok(textOf(result).length > 0);
});

test("repair_build: non-object build returns isError true, no throw", () => {
  const result = repairBuildHandler({ build: NOT_AN_OBJECT, errors: [] });
  assert.equal(result.isError, true);
  assert.ok(textOf(result).length > 0);
});

test("repair_build: components not an array returns isError true, no throw", () => {
  const result = repairBuildHandler({ build: COMPONENTS_NOT_ARRAY, errors: [] });
  assert.equal(result.isError, true);
  assert.ok(textOf(result).length > 0);
});

test("repair_build: errors referencing a component absent from the build returns isError true, no throw", () => {
  const build: Build = {
    components: [
      { type: "cpu", id: "cpu1", socket: "LGA1700" },
      { type: "mainboard", id: "mb1", socket: "AM5" },
    ],
  };
  const errors: CompilerError[] = [
    {
      code: "E001",
      severity: "error",
      name: "SOCKET_MISMATCH",
      message: "mismatch",
      component_refs: ["cpu1", "ghost-component"],
    },
  ];
  const result = repairBuildHandler({ build, errors });
  assert.equal(result.isError, true);
  assert.ok(textOf(result).length > 0);
});

test("determinism: repeated compile_build calls with identical input return identical output (FR-007)", () => {
  const build: Build = {
    components: [
      { type: "cpu", id: "cpu1", socket: "LGA1700" },
      { type: "mainboard", id: "mb1", socket: "AM5" },
    ],
  };
  const first = compileBuildHandler({ build });
  const second = compileBuildHandler({ build });
  assert.equal(textOf(first), textOf(second));
});
