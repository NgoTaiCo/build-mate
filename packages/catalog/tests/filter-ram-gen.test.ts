import { test } from "node:test";
import assert from "node:assert/strict";
import { searchComponentsMock } from "../src/index.js";

test("RAM generation filter", async (t) => {
  await t.test("should filter mainboards by DDR5", () => {
    const results = searchComponentsMock({
      type: "mainboard",
      ram_gen: "DDR5",
    });

    assert(results.length > 0, "Should find DDR5 mainboards");
    assert(
      results.every((c) =>
        c.ram_gen === "DDR5"
      ),
      "All mainboards should support DDR5"
    );
  });

  await t.test("should filter RAM modules by DDR5", () => {
    const results = searchComponentsMock({
      type: "ram",
      ram_gen: "DDR5",
    });

    assert(results.length > 0, "Should find DDR5 RAM");
    assert(
      results.every((c) => c.ram_gen === "DDR5"),
      "All RAM should be DDR5"
    );
  });

  await t.test("should filter RAM modules by DDR4", () => {
    const results = searchComponentsMock({
      type: "ram",
      ram_gen: "DDR4",
    });

    assert(results.length > 0, "Should find DDR4 RAM");
    assert(
      results.every((c) => c.ram_gen === "DDR4"),
      "All RAM should be DDR4"
    );
  });

  await t.test("should return empty for CPUs with ram_gen filter (not supported)", () => {
    const results = searchComponentsMock({
      type: "cpu",
      ram_gen: "DDR5",
    });

    // CPUs don't have ram_gen in our data model, so filtering by ram_gen returns empty
    assert(results.length === 0, "CPUs should not match ram_gen filter");
  });

  await t.test("should return empty for unknown RAM generation", () => {
    const results = searchComponentsMock({
      type: "ram",
      ram_gen: "DDR7",
    });

    assert.equal(results.length, 0, "Should return empty for unknown generation");
  });

  await t.test("should not match RAM gen filter on types without ram field", () => {
    const results = searchComponentsMock({
      type: "psu",
      ram_gen: "DDR5",
    });

    assert.equal(results.length, 0, "PSU should not match ram_gen filter");
  });

  await t.test("should work with other filters combined", () => {
    const results = searchComponentsMock({
      type: "mainboard",
      socket: "AM5",
      ram_gen: "DDR5",
    });

    assert(
      results.every(
        (c) =>
          c.type === "mainboard" &&
          c.socket === "AM5" &&
          c.ram_gen === "DDR5"
      ),
      "Should apply all filters together"
    );
  });

  await t.test("should maintain deterministic order across calls", () => {
    const results1 = searchComponentsMock({
      type: "ram",
      ram_gen: "DDR5",
    });
    const results2 = searchComponentsMock({
      type: "ram",
      ram_gen: "DDR5",
    });

    assert.equal(results1.length, results2.length, "Should return same count");
    for (let i = 0; i < results1.length; i++) {
      assert.equal(results1[i].id, results2[i].id, `Index ${i} should match`);
    }
  });
});
