import test from "node:test";
import assert from "node:assert/strict";
import { checkRamGen } from "../src/rules/ram-gen.js";
import type { Build } from "../src/types.js";

test("ram-gen rule: pass when ram generation supported by cpu and mainboard", () => {
  const build: Build = {
    components: [
      { type: "cpu", id: "cpu1", ram_gen_supported: ["DDR4", "DDR5"] },
      { type: "mainboard", id: "mb1", ram_gen_supported: ["DDR5"] },
      { type: "ram", id: "ram1", generation: "DDR5" },
    ],
  };
  assert.deepEqual(checkRamGen(build), []);
});

test("ram-gen rule: fail E002 when ram generation unsupported", () => {
  const build: Build = {
    components: [
      { type: "cpu", id: "cpu1", ram_gen_supported: ["DDR5"] },
      { type: "mainboard", id: "mb1", ram_gen_supported: ["DDR5"] },
      { type: "ram", id: "ram1", generation: "DDR4" },
    ],
  };
  const errors = checkRamGen(build);
  assert.equal(errors.length, 1);
  assert.equal(errors[0].code, "E002");
  assert.equal(errors[0].severity, "error");
});

test("ram-gen rule: multi-stick - one bad stick among good ones is flagged", () => {
  const build: Build = {
    components: [
      { type: "cpu", id: "cpu1", ram_gen_supported: ["DDR5"] },
      { type: "mainboard", id: "mb1", ram_gen_supported: ["DDR5"] },
      { type: "ram", id: "ram1", generation: "DDR5" },
      { type: "ram", id: "ram2", generation: "DDR4" },
      { type: "ram", id: "ram3", generation: "DDR5" },
    ],
  };
  const errors = checkRamGen(build);
  assert.equal(errors.length, 1);
  assert.equal(errors[0].code, "E002");
  assert.deepEqual(errors[0].component_refs.includes("ram2"), true);
});

test("ram-gen rule: no ram/cpu/mainboard -> no error (E003 handles missing)", () => {
  const build: Build = { components: [] };
  assert.deepEqual(checkRamGen(build), []);
});
