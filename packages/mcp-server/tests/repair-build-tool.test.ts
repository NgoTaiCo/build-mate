import test from "node:test";
import assert from "node:assert/strict";
import { detectErrors, repairBuild } from "@buildmate/compiler";
import type { Build, Change, Component } from "@buildmate/compiler";
import { repairBuildHandler } from "../src/tools/repair-build.js";

function textOf(result: { content: Array<{ type: string; text?: string }> }): string {
  const first = result.content[0];
  assert.equal(first.type, "text");
  return first.text ?? "";
}

function applyChange(build: Build, change: Change): Build {
  return {
    components: build.components.map((c) =>
      c.id === change.component_ref
        ? ({ ...c, [change.attribute]: change.target_value } as Component)
        : c,
    ),
  };
}

test("repair_build: matches direct repairBuild() call, byte-identical, 1:1 with errors", () => {
  const build: Build = {
    components: [
      { type: "cpu", id: "cpu1", socket: "LGA1700" },
      { type: "mainboard", id: "mb1", socket: "AM5" },
    ],
  };
  const errors = detectErrors(build);
  const result = repairBuildHandler({ build, errors });
  assert.equal(result.isError, false);
  assert.equal(textOf(result), JSON.stringify(repairBuild(build, errors)));

  const repairPlan = JSON.parse(textOf(result));
  assert.equal(repairPlan.length, errors.length);
  assert.ok(repairPlan[0].fixes.length > 0);
  assert.ok(typeof repairPlan[0].fixes[0].changes[0].target_value !== "undefined");
});

test("repair_build: multi-error build returns at least one fix per error, 1:1 mapping", () => {
  const build: Build = {
    components: [
      { type: "cpu", id: "cpu1", socket: "LGA1700", ram_gen_supported: ["DDR5"] },
      { type: "mainboard", id: "mb1", socket: "AM5", ram_gen_supported: ["DDR4"] },
      { type: "ram", id: "ram1", generation: "DDR3" },
    ],
  };
  const errors = detectErrors(build);
  const result = repairBuildHandler({ build, errors });
  assert.equal(result.isError, false);

  const repairPlan = JSON.parse(textOf(result));
  assert.equal(repairPlan.length, errors.length);
  for (const plan of repairPlan) {
    assert.ok(plan.fixes.length > 0, `expected at least one fix for ${plan.error_code}`);
  }
});

test("repair_build: applying the suggested fix resolves the original error on re-detect", () => {
  const build: Build = {
    components: [
      { type: "cpu", id: "cpu1", socket: "LGA1700" },
      { type: "mainboard", id: "mb1", socket: "AM5" },
    ],
  };
  const errors = detectErrors(build);
  assert.ok(errors.some((e) => e.code === "E001"));

  const result = repairBuildHandler({ build, errors });
  const repairPlan = JSON.parse(textOf(result));
  const socketPlan = repairPlan.find((p: { error_code: string }) => p.error_code === "E001");
  const fixedBuild = applyChange(build, socketPlan.fixes[0].changes[0]);

  const remainingErrors = detectErrors(fixedBuild);
  assert.ok(!remainingErrors.some((e) => e.code === "E001"));
});

test("repair_build: empty errors list returns an empty repair plan", () => {
  const build: Build = { components: [] };
  const result = repairBuildHandler({ build, errors: [] });
  assert.equal(result.isError, false);
  assert.deepEqual(JSON.parse(textOf(result)), []);
});

test("repair_build: errors referencing a component absent from the build return isError true", () => {
  const build: Build = {
    components: [
      { type: "cpu", id: "cpu1", socket: "LGA1700" },
      { type: "mainboard", id: "mb1", socket: "AM5" },
    ],
  };
  const errors = [
    {
      code: "E001" as const,
      severity: "error" as const,
      name: "SOCKET_MISMATCH",
      message: "mismatch",
      component_refs: ["cpu1", "mb-does-not-exist"],
    },
  ];
  const result = repairBuildHandler({ build, errors });
  assert.equal(result.isError, true);
  assert.ok(textOf(result).length > 0);
});
