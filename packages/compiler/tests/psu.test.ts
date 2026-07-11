import test from "node:test";
import assert from "node:assert/strict";
import { checkPsu } from "../src/rules/psu.js";
import type { Build } from "../src/types.js";

test("psu rule: pass when wattage comfortably exceeds TDP total x 1.2", () => {
  const build: Build = {
    components: [
      { type: "cpu", id: "cpu1", tdp: 65 },
      { type: "gpu", id: "gpu1", tdp: 220 },
      { type: "ram", id: "ram1", tdp: 9 },
      { type: "storage", id: "sto1", tdp: 5 },
      { type: "psu", id: "psu1", wattage: 550 },
    ],
  };
  // total excl psu = 65+220+9+5 = 299; x1.2 = 358.8; 550 > 358.8 -> pass
  assert.deepEqual(checkPsu(build), []);
});

test("psu rule: warn W001 when wattage below TDP total x 1.2", () => {
  const build: Build = {
    components: [
      { type: "cpu", id: "cpu1", tdp: 300 },
      { type: "gpu", id: "gpu1", tdp: 300 },
      { type: "psu", id: "psu1", wattage: 550 },
    ],
  };
  // total excl psu = 600; x1.2 = 720; 550 < 720 -> W001
  const errors = checkPsu(build);
  assert.equal(errors.length, 1);
  assert.equal(errors[0].code, "W001");
  assert.equal(errors[0].severity, "warning");
});

test("psu rule: boundary - wattage === tdp_total x 1.2 passes (no warning)", () => {
  const build: Build = {
    components: [
      { type: "cpu", id: "cpu1", tdp: 500 },
      { type: "psu", id: "psu1", wattage: 600 },
    ],
  };
  // total excl psu = 500; x1.2 = 600; 600 === 600 -> pass
  assert.deepEqual(checkPsu(build), []);
});

test("psu rule: PSU tdp excluded from sum even if malformed catalog sets it", () => {
  const build: Build = {
    components: [
      { type: "cpu", id: "cpu1", tdp: 100 },
      { type: "psu", id: "psu1", wattage: 150, tdp: 50 } as any,
    ],
  };
  // total excl psu = 100 (psu's own tdp:50 must be excluded); x1.2 = 120; 150 > 120 -> pass, no false W001
  assert.deepEqual(checkPsu(build), []);
});

test("psu rule: no psu -> no error (E003 handles missing)", () => {
  assert.deepEqual(checkPsu({ components: [{ type: "cpu", id: "cpu1", tdp: 500 }] }), []);
});

test("psu rule: missing psu.wattage -> E006, not crash", () => {
  const build: Build = {
    components: [
      { type: "cpu", id: "cpu1", tdp: 100 },
      { type: "psu", id: "psu1" },
    ],
  };
  const errors = checkPsu(build);
  assert.equal(errors.length, 1);
  assert.equal(errors[0].code, "E006");
});
