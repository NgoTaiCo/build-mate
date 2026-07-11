import test from "node:test";
import assert from "node:assert/strict";
import { detectErrors } from "../src/index.js";
import { repairBuild } from "../src/repair.js";
import type { Build, Change, Component, Fix } from "../src/types.js";

function applyFix(build: Build, fix: Fix): Build {
  let components = [...build.components];
  for (const change of fix.changes) {
    if (change.component_ref.startsWith("type:") && change.attribute === "type") {
      components = [
        ...components,
        { type: change.target_value as string, id: `${change.target_value as string}-added` } as Component,
      ];
    } else {
      components = components.map((c) =>
        c.id === change.component_ref
          ? ({ ...c, [(change as Change).attribute]: change.target_value } as Component)
          : c,
      );
    }
  }
  return { components };
}

function assertConstraintBased(fix: Fix) {
  for (const change of fix.changes) {
    const ok =
      typeof change.target_value === "string" ||
      typeof change.target_value === "number" ||
      Array.isArray(change.target_value);
    assert.equal(ok, true, "target_value must be a constraint (string/number/string[]), not a SKU object");
  }
}

test("repairBuild: errors empty -> returns empty plan", () => {
  assert.deepEqual(repairBuild({ components: [] }, []), []);
});

test("repair E001 SOCKET_MISMATCH: round-trip resolves original error", () => {
  const build: Build = {
    components: [
      { type: "cpu", id: "cpu1", socket: "LGA1700", ram_gen_supported: ["DDR5"], tdp: 65 },
      { type: "mainboard", id: "mb1", socket: "AM5", ram_gen_supported: ["DDR5"], form_factor: "ATX" },
      { type: "ram", id: "ram1", generation: "DDR5" },
      { type: "psu", id: "psu1", wattage: 650, form_factor: "ATX" },
      { type: "cooler", id: "cool1", height: 150 },
      { type: "case", id: "case1", max_cooler_height: 165, supported_mb_form_factors: ["ATX"], supported_psu_form_factors: ["ATX"] },
      { type: "storage", id: "sto1" },
    ],
  };
  const errors = detectErrors(build);
  assert.ok(errors.some((e) => e.code === "E001"));
  const plans = repairBuild(build, errors);
  assert.equal(plans.length, errors.length);
  const plan = plans.find((p) => p.error_code === "E001")!;
  assert.ok(plan.fixes.length >= 1);
  plan.fixes.forEach(assertConstraintBased);

  const repaired = applyFix(build, plan.fixes[0]);
  const after = detectErrors(repaired);
  assert.ok(!after.some((e) => e.code === "E001"));
});

test("repair E002 RAM_GEN_MISMATCH: round-trip resolves original error", () => {
  const build: Build = {
    components: [
      { type: "cpu", id: "cpu1", socket: "AM5", ram_gen_supported: ["DDR5"], tdp: 65 },
      { type: "mainboard", id: "mb1", socket: "AM5", ram_gen_supported: ["DDR5"], form_factor: "ATX" },
      { type: "ram", id: "ram1", generation: "DDR4" },
      { type: "psu", id: "psu1", wattage: 650, form_factor: "ATX" },
      { type: "cooler", id: "cool1", height: 150 },
      { type: "case", id: "case1", max_cooler_height: 165, supported_mb_form_factors: ["ATX"], supported_psu_form_factors: ["ATX"] },
      { type: "storage", id: "sto1" },
    ],
  };
  const errors = detectErrors(build);
  assert.ok(errors.some((e) => e.code === "E002"));
  const plans = repairBuild(build, errors);
  const plan = plans.find((p) => p.error_code === "E002")!;
  assert.ok(plan.fixes.length >= 1);
  plan.fixes.forEach(assertConstraintBased);

  const repaired = applyFix(build, plan.fixes[0]);
  const after = detectErrors(repaired);
  assert.ok(!after.some((e) => e.code === "E002"));
});

test("repair E003 MISSING_COMPONENT: round-trip resolves original error", () => {
  const build: Build = {
    components: [
      { type: "cpu", id: "cpu1", socket: "AM5", ram_gen_supported: ["DDR5"], tdp: 65 },
      { type: "mainboard", id: "mb1", socket: "AM5", ram_gen_supported: ["DDR5"], form_factor: "ATX" },
      { type: "ram", id: "ram1", generation: "DDR5" },
      { type: "psu", id: "psu1", wattage: 650, form_factor: "ATX" },
      { type: "cooler", id: "cool1", height: 150 },
      { type: "case", id: "case1", max_cooler_height: 165, supported_mb_form_factors: ["ATX"], supported_psu_form_factors: ["ATX"] },
      // storage missing
    ],
  };
  const errors = detectErrors(build);
  const storageError = errors.find((e) => e.code === "E003" && e.details?.missing_type === "storage")!;
  assert.ok(storageError);
  const plans = repairBuild(build, [storageError]);
  assert.equal(plans.length, 1);
  const plan = plans[0];
  assert.ok(plan.fixes.length >= 1);
  plan.fixes.forEach(assertConstraintBased);

  const repaired = applyFix(build, plan.fixes[0]);
  const after = detectErrors(repaired);
  assert.ok(!after.some((e) => e.code === "E003" && e.details?.missing_type === "storage"));
});

test("repair E004 COOLER_CLEARANCE_MISMATCH: round-trip resolves original error", () => {
  const build: Build = {
    components: [
      { type: "cpu", id: "cpu1", socket: "AM5", ram_gen_supported: ["DDR5"], tdp: 65 },
      { type: "mainboard", id: "mb1", socket: "AM5", ram_gen_supported: ["DDR5"], form_factor: "ATX" },
      { type: "ram", id: "ram1", generation: "DDR5" },
      { type: "psu", id: "psu1", wattage: 650, form_factor: "ATX" },
      { type: "cooler", id: "cool1", height: 200 },
      { type: "case", id: "case1", max_cooler_height: 165, supported_mb_form_factors: ["ATX"], supported_psu_form_factors: ["ATX"] },
      { type: "storage", id: "sto1" },
    ],
  };
  const errors = detectErrors(build);
  assert.ok(errors.some((e) => e.code === "E004"));
  const plans = repairBuild(build, errors);
  const plan = plans.find((p) => p.error_code === "E004")!;
  assert.ok(plan.fixes.length >= 1);
  plan.fixes.forEach(assertConstraintBased);

  const repaired = applyFix(build, plan.fixes[0]);
  const after = detectErrors(repaired);
  assert.ok(!after.some((e) => e.code === "E004"));
});

test("repair E005 FORM_FACTOR_MISMATCH: round-trip resolves original error", () => {
  const build: Build = {
    components: [
      { type: "cpu", id: "cpu1", socket: "AM5", ram_gen_supported: ["DDR5"], tdp: 65 },
      { type: "mainboard", id: "mb1", socket: "AM5", ram_gen_supported: ["DDR5"], form_factor: "E-ATX" },
      { type: "ram", id: "ram1", generation: "DDR5" },
      { type: "psu", id: "psu1", wattage: 650, form_factor: "ATX" },
      { type: "cooler", id: "cool1", height: 150 },
      { type: "case", id: "case1", max_cooler_height: 165, supported_mb_form_factors: ["ATX"], supported_psu_form_factors: ["ATX"] },
      { type: "storage", id: "sto1" },
    ],
  };
  const errors = detectErrors(build);
  assert.ok(errors.some((e) => e.code === "E005"));
  const plans = repairBuild(build, errors);
  const plan = plans.find((p) => p.error_code === "E005")!;
  assert.ok(plan.fixes.length >= 1);
  plan.fixes.forEach(assertConstraintBased);

  const repaired = applyFix(build, plan.fixes[0]);
  const after = detectErrors(repaired);
  assert.ok(!after.some((e) => e.code === "E005"));
});

test("repair E006 MISSING_ATTRIBUTE: round-trip resolves original error", () => {
  const build: Build = {
    components: [
      { type: "cpu", id: "cpu1", ram_gen_supported: ["DDR5"], tdp: 65 }, // socket missing
      { type: "mainboard", id: "mb1", socket: "AM5", ram_gen_supported: ["DDR5"], form_factor: "ATX" },
      { type: "ram", id: "ram1", generation: "DDR5" },
      { type: "psu", id: "psu1", wattage: 650, form_factor: "ATX" },
      { type: "cooler", id: "cool1", height: 150 },
      { type: "case", id: "case1", max_cooler_height: 165, supported_mb_form_factors: ["ATX"], supported_psu_form_factors: ["ATX"] },
      { type: "storage", id: "sto1" },
    ],
  };
  const errors = detectErrors(build);
  assert.ok(errors.some((e) => e.code === "E006"));
  const plans = repairBuild(build, errors);
  const plan = plans.find((p) => p.error_code === "E006")!;
  assert.ok(plan.fixes.length >= 1);
  plan.fixes.forEach(assertConstraintBased);

  const repaired = applyFix(build, plan.fixes[0]);
  const after = detectErrors(repaired);
  assert.ok(!after.some((e) => e.code === "E006"));
});
