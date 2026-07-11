import test from "node:test";
import assert from "node:assert/strict";
import { checkFormFactor } from "../src/rules/form-factor.js";
import type { Build } from "../src/types.js";

test("form-factor rule: pass when mainboard and psu form factors supported by case", () => {
  const build: Build = {
    components: [
      { type: "mainboard", id: "mb1", form_factor: "ATX" },
      { type: "psu", id: "psu1", form_factor: "ATX" },
      {
        type: "case",
        id: "case1",
        supported_mb_form_factors: ["ATX", "mATX"],
        supported_psu_form_factors: ["ATX"],
      },
    ],
  };
  assert.deepEqual(checkFormFactor(build), []);
});

test("form-factor rule: fail E005 when mainboard form factor unsupported", () => {
  const build: Build = {
    components: [
      { type: "mainboard", id: "mb1", form_factor: "E-ATX" },
      { type: "psu", id: "psu1", form_factor: "ATX" },
      {
        type: "case",
        id: "case1",
        supported_mb_form_factors: ["ATX", "mATX"],
        supported_psu_form_factors: ["ATX"],
      },
    ],
  };
  const errors = checkFormFactor(build);
  assert.equal(errors.length, 1);
  assert.equal(errors[0].code, "E005");
  assert.deepEqual(errors[0].component_refs, ["mb1", "case1"]);
});

test("form-factor rule: fail E005 when psu form factor unsupported", () => {
  const build: Build = {
    components: [
      { type: "mainboard", id: "mb1", form_factor: "ATX" },
      { type: "psu", id: "psu1", form_factor: "SFX" },
      {
        type: "case",
        id: "case1",
        supported_mb_form_factors: ["ATX"],
        supported_psu_form_factors: ["ATX"],
      },
    ],
  };
  const errors = checkFormFactor(build);
  assert.equal(errors.length, 1);
  assert.equal(errors[0].code, "E005");
  assert.deepEqual(errors[0].component_refs, ["psu1", "case1"]);
});

test("form-factor rule: no case -> no error (E003 handles missing)", () => {
  assert.deepEqual(checkFormFactor({ components: [] }), []);
});
