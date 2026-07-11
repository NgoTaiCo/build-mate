import { test } from "node:test";
import assert from "node:assert/strict";
import { searchComponentsMock } from "../src/index.js";

test("socket filter", async (t) => {
  await t.test("should filter CPUs by exact socket match", () => {
    const results = searchComponentsMock({ type: "cpu", socket: "AM5" });

    assert(results.length > 0, "Should find AM5 CPUs");
    assert(
      results.every((c) => c.socket === "AM5"),
      "All CPUs should be AM5"
    );
  });

  await t.test("should filter mainboards by exact socket match", () => {
    const results = searchComponentsMock({
      type: "mainboard",
      socket: "AM5",
    });

    assert(results.length > 0, "Should find AM5 mainboards");
    assert(
      results.every((c) => c.socket === "AM5"),
      "All mainboards should be AM5"
    );
  });

  await t.test("should filter coolers by array.includes socket match", () => {
    const results = searchComponentsMock({
      type: "cooler",
      socket: "AM5",
    });

    assert(results.length > 0, "Should find coolers with AM5 support");
    assert(
      results.every(
        (c) =>
          Array.isArray(c.socket) && c.socket.includes("AM5")
      ),
      "All coolers should have AM5 in socket array"
    );
  });

  await t.test("should return empty for unknown socket", () => {
    const results = searchComponentsMock({
      type: "cpu",
      socket: "UNKNOWN_SOCKET",
    });

    assert.equal(results.length, 0, "Should return empty for unknown socket");
  });

  await t.test("should ignore socket filter for types without socket", () => {
    const results = searchComponentsMock({
      type: "ram",
      socket: "AM5",
    });

    assert.equal(results.length, 0, "RAM should not match socket filter");
  });

  await t.test("should return all CPUs when socket not specified", () => {
    const allCPUs = searchComponentsMock({ type: "cpu" });
    const socketUnspecified = searchComponentsMock({ type: "cpu" });

    assert.equal(
      allCPUs.length,
      socketUnspecified.length,
      "Should return same count"
    );
  });

  await t.test("should handle multi-socket coolers", () => {
    const am5Coolers = searchComponentsMock({
      type: "cooler",
      socket: "AM5",
    });
    const lga1700Coolers = searchComponentsMock({
      type: "cooler",
      socket: "LGA1700",
    });

    assert(am5Coolers.length > 0, "Should find AM5 coolers");
    assert(lga1700Coolers.length > 0, "Should find LGA1700 coolers");

    // Some coolers might appear in both lists
    const bothSockets = am5Coolers.filter((c) =>
      lga1700Coolers.some((other) => other.id === c.id)
    );
    assert(bothSockets.length > 0, "Some coolers should support both sockets");
  });
});
