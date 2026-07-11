import test from "node:test";
import assert from "node:assert/strict";
import { checkMissing } from "../src/rules/missing.js";
import { REQUIRED_COMPONENT_TYPES } from "../src/codes.js";
import type { Build } from "../src/types.js";

const FULL_BUILD: Build = {
  components: [
    { type: "cpu", id: "cpu1" },
    { type: "mainboard", id: "mb1" },
    { type: "ram", id: "ram1" },
    { type: "psu", id: "psu1" },
    { type: "cooler", id: "cool1" },
    { type: "case", id: "case1" },
    { type: "storage", id: "sto1" },
  ],
};

test("missing rule: empty build triggers E003 for all 7 required types", () => {
  const errors = checkMissing({ components: [] });
  assert.equal(errors.length, REQUIRED_COMPONENT_TYPES.length);
  for (const e of errors) {
    assert.equal(e.code, "E003");
    assert.equal(e.severity, "error");
  }
  const missingTypes = errors.map((e) => e.details?.missing_type);
  assert.deepEqual(missingTypes.sort(), [...REQUIRED_COMPONENT_TYPES].sort());
});

test("missing rule: all 7 types present -> no E003", () => {
  assert.deepEqual(checkMissing(FULL_BUILD), []);
});

for (const requiredType of REQUIRED_COMPONENT_TYPES) {
  test(`missing rule: build missing only "${requiredType}" triggers E003 for that type`, () => {
    const build: Build = {
      components: FULL_BUILD.components.filter((c) => c.type !== requiredType),
    };
    const errors = checkMissing(build);
    assert.equal(errors.length, 1);
    assert.equal(errors[0].code, "E003");
    assert.deepEqual(errors[0].component_refs, [`type:${requiredType}`]);
  });
}

test("missing rule: non-required type present (gpu) does not satisfy required types", () => {
  const errors = checkMissing({ components: [{ type: "gpu", id: "gpu1", tdp: 200 }] });
  assert.equal(errors.length, REQUIRED_COMPONENT_TYPES.length);
});
