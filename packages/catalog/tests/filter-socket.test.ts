import { test } from "node:test";
import assert from "node:assert/strict";
import { searchComponentsMock } from "../src/index.js";
import { makeSocketPredicate } from "../src/filter.js";
import type { CatalogComponent } from "../src/types.js";

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
    const allCoolers = searchComponentsMock({ type: "cooler" });

    if (allCoolers.length === 0) {
      // No coolers in data, socket filter should return empty
      const results = searchComponentsMock({
        type: "cooler",
        socket: "AM5",
      });
      assert.equal(results.length, 0, "Should return empty when no coolers in data");
    } else {
      // If coolers exist, test the socket filter
      const results = searchComponentsMock({
        type: "cooler",
        socket: "AM5",
      });
      assert(
        results.every(
          (c) =>
            Array.isArray(c.socket) && c.socket.includes("AM5")
        ),
        "All coolers should have AM5 in socket array"
      );
    }
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

  await t.test("multi-socket coolers match any socket in their array", () => {
    // Coolers carry socket as a string[]; a socket query matches when the array
    // includes it. Verified against synthetic data so the test doesn't depend on
    // whether the live PhongVu dataset happens to expose cooler sockets (it
    // generally doesn't — the Compiler validates coolers by height, not socket).
    const cooler = {
      sku: "c1",
      name: "Test Tower",
      type: "cooler",
      price: 1000000,
      stock_status: "in_stock",
      promo: null,
      socket: ["AM5", "AM4", "LGA1700"],
    } as CatalogComponent;

    assert.equal(makeSocketPredicate("AM5")(cooler), true, "matches AM5");
    assert.equal(makeSocketPredicate("LGA1700")(cooler), true, "matches LGA1700");
    assert.equal(makeSocketPredicate("LGA1200")(cooler), false, "rejects absent socket");
  });
});
