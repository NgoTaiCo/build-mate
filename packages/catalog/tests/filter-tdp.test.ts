import { test } from "node:test";
import assert from "node:assert/strict";
import { searchComponentsMock } from "../src/index.js";

test("TDP filter", async (t) => {
  await t.test("should filter CPUs by TDP range", () => {
    const results = searchComponentsMock({
      type: "cpu",
      tdp_min: 65,
      tdp_max: 150,
    });

    assert(results.length > 0, "Should find CPUs in TDP range");
    assert(
      results.every((c) => (c.tdp || 0) >= 65 && (c.tdp || 0) <= 150),
      "All TDP values should be in range"
    );
  });

  await t.test("should support tdp_min only", () => {
    const results = searchComponentsMock({
      type: "cpu",
      tdp_min: 100,
    });

    assert(
      results.every((c) => (c.tdp || 0) >= 100),
      "All TDP should be >= min"
    );
  });

  await t.test("should support tdp_max only", () => {
    const results = searchComponentsMock({
      type: "cpu",
      tdp_max: 100,
    });

    assert(
      results.every((c) => (c.tdp || 0) <= 100),
      "All TDP should be <= max"
    );
  });

  await t.test("should filter GPUs by TDP", () => {
    const results = searchComponentsMock({
      type: "gpu",
      tdp_min: 200,
    });

    assert(results.length > 0, "Should find GPUs with TDP >= 200");
    assert(
      results.every((c) => (c.tdp || 0) >= 200),
      "All GPUs should have TDP >= 200"
    );
  });

  await t.test("should filter coolers by TDP rating", () => {
    const allCoolers = searchComponentsMock({ type: "cooler" });

    if (allCoolers.length === 0) {
      // If no coolers in data, test that the filter works correctly (returns empty)
      const results = searchComponentsMock({
        type: "cooler",
        tdp_min: 250,
      });
      assert.equal(results.length, 0, "Should return empty when no coolers match");
    } else {
      // If coolers exist, test the filtering
      const results = searchComponentsMock({
        type: "cooler",
        tdp_min: 250,
      });
      assert(
        results.every((c) => (c.tdp || 0) >= 250),
        "All coolers should have TDP >= 250"
      );
    }
  });

  await t.test("should return empty when min > max", () => {
    const results = searchComponentsMock({
      type: "cpu",
      tdp_min: 200,
      tdp_max: 100,
    });

    assert.equal(results.length, 0, "Should return empty when min > max");
  });

  await t.test("should skip types without TDP field", () => {
    const results = searchComponentsMock({
      type: "storage",
      tdp_min: 10,
    });

    assert.equal(results.length, 0, "Storage should not match TDP filter");
  });

  await t.test("should include boundary values", () => {
    const allCPUs = searchComponentsMock({ type: "cpu" });
    if (allCPUs.length > 0) {
      const testTDP = allCPUs[0].tdp;

      const results = searchComponentsMock({
        type: "cpu",
        tdp_min: testTDP,
        tdp_max: testTDP,
      });

      assert(
        results.some((c) => c.id === allCPUs[0].id),
        "Should include component with exact TDP"
      );
    }
  });

  await t.test("should work with other filters combined", () => {
    const results = searchComponentsMock({
      type: "gpu",
      tdp_min: 200,
      tdp_max: 350,
      stock_status: "in_stock",
    });

    assert(
      results.every(
        (c) =>
          c.type === "gpu" &&
          (c.tdp || 0) >= 200 &&
          (c.tdp || 0) <= 350 &&
          c.stock_status === "in_stock"
      ),
      "Should apply all filters together"
    );
  });
});
