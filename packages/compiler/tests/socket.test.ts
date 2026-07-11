import test from "node:test";
import assert from "node:assert/strict";
import { checkSocket } from "../src/rules/socket.js";
import type { Build } from "../src/types.js";

test("socket rule: pass when cpu and mainboard sockets match", () => {
  const build: Build = {
    components: [
      { type: "cpu", id: "cpu1", socket: "AM5" },
      { type: "mainboard", id: "mb1", socket: "AM5" },
    ],
  };
  assert.deepEqual(checkSocket(build), []);
});

test("socket rule: fail E001 when sockets mismatch", () => {
  const build: Build = {
    components: [
      { type: "cpu", id: "cpu1", socket: "LGA1700" },
      { type: "mainboard", id: "mb1", socket: "AM5" },
    ],
  };
  const errors = checkSocket(build);
  assert.equal(errors.length, 1);
  assert.equal(errors[0].code, "E001");
  assert.equal(errors[0].severity, "error");
  assert.deepEqual(errors[0].component_refs, ["cpu1", "mb1"]);
});

test("socket rule: boundary - exact case-sensitive string match required", () => {
  const build: Build = {
    components: [
      { type: "cpu", id: "cpu1", socket: "AM5" },
      { type: "mainboard", id: "mb1", socket: "am5" },
    ],
  };
  const errors = checkSocket(build);
  assert.equal(errors.length, 1);
  assert.equal(errors[0].code, "E001");
});

test("socket rule: no cpu or mainboard -> no error (E003 handles missing)", () => {
  const build: Build = { components: [] };
  assert.deepEqual(checkSocket(build), []);
});
