import test from "node:test";
import assert from "node:assert/strict";
import { checkCooler } from "../src/rules/cooler.js";
import type { Build } from "../src/types.js";

test("cooler rule: pass when cooler height fits case clearance", () => {
  const build: Build = {
    components: [
      { type: "cooler", id: "cool1", height: 150 },
      { type: "case", id: "case1", max_cooler_height: 165 },
    ],
  };
  assert.deepEqual(checkCooler(build), []);
});

test("cooler rule: fail E004 when cooler height exceeds case max", () => {
  const build: Build = {
    components: [
      { type: "cooler", id: "cool1", height: 180 },
      { type: "case", id: "case1", max_cooler_height: 165 },
    ],
  };
  const errors = checkCooler(build);
  assert.equal(errors.length, 1);
  assert.equal(errors[0].code, "E004");
  assert.equal(errors[0].severity, "error");
});

test("cooler rule: boundary - height === max_cooler_height passes", () => {
  const build: Build = {
    components: [
      { type: "cooler", id: "cool1", height: 165 },
      { type: "case", id: "case1", max_cooler_height: 165 },
    ],
  };
  assert.deepEqual(checkCooler(build), []);
});

test("cooler rule: no cooler or case -> no error (E003 handles missing)", () => {
  assert.deepEqual(checkCooler({ components: [] }), []);
});
