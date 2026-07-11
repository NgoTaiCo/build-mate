import test from "node:test";
import assert from "node:assert/strict";
import { validate } from "../src/validate.js";
import type { Build } from "../src/types.js";

const VALID_BUILD: Build = {
  components: [
    { type: "cpu", id: "cpu1", socket: "AM5", ram_gen_supported: ["DDR5"], tdp: 65 },
    { type: "mainboard", id: "mb1", socket: "AM5", ram_gen_supported: ["DDR5"], form_factor: "ATX" },
    { type: "ram", id: "ram1", generation: "DDR5", tdp: 9 },
    { type: "psu", id: "psu1", wattage: 650, form_factor: "ATX" },
    { type: "cooler", id: "cool1", height: 150 },
    {
      type: "case",
      id: "case1",
      max_cooler_height: 165,
      supported_mb_form_factors: ["ATX"],
      supported_psu_form_factors: ["ATX"],
    },
    { type: "storage", id: "sto1", tdp: 5 },
  ],
};

test("validate: valid build returns no errors", () => {
  assert.deepEqual(validate(VALID_BUILD), []);
});

test("validate: multi-error simultaneous - socket and ram-gen mismatch both reported", () => {
  const build: Build = {
    ...VALID_BUILD,
    components: VALID_BUILD.components.map((c) => {
      if (c.type === "cpu") return { ...c, socket: "LGA1700" };
      if (c.type === "ram") return { ...c, generation: "DDR4" };
      return c;
    }),
  };
  const errors = validate(build);
  const codes = errors.map((e) => e.code);
  assert.ok(codes.includes("E001"));
  assert.ok(codes.includes("E002"));
});

test("validate: empty build - all errors are E003 for the 7 required types", () => {
  const errors = validate({ components: [] });
  assert.equal(errors.length, 7);
  assert.ok(errors.every((e) => e.code === "E003"));
});

test("validate: missing attribute produces E006 without crashing", () => {
  const build: Build = {
    ...VALID_BUILD,
    components: VALID_BUILD.components.map((c) =>
      c.type === "cpu" ? { type: "cpu", id: "cpu1" } : c,
    ),
  };
  const errors = validate(build);
  const codes = errors.map((e) => e.code);
  assert.ok(codes.includes("E006"));
});

test("validate: deterministic - same input produces byte-identical output", () => {
  const first = validate(VALID_BUILD);
  const second = validate(VALID_BUILD);
  assert.deepEqual(first, second);
  assert.equal(JSON.stringify(first), JSON.stringify(second));
});
