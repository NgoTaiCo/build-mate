import { test } from "node:test";
import assert from "node:assert/strict";
import { searchComponentsMock } from "../src/index.js";

test("wattage filter", async (t) => {
  await t.test("should filter PSUs by wattage range", () => {
    const results = searchComponentsMock({
      type: "psu",
      wattage_min: 650,
      wattage_max: 850,
    });

    assert(results.length > 0, "Should find PSUs in wattage range");
    assert(
      results.every((c) => (c.wattage || 0) >= 650 && (c.wattage || 0) <= 850),
      "All wattages should be in range"
    );
  });

  await t.test("should support wattage_min only", () => {
    const results = searchComponentsMock({
      type: "psu",
      wattage_min: 750,
    });

    assert(results.length > 0, "Should find PSUs with wattage >= 750");
    assert(
      results.every((c) => (c.wattage || 0) >= 750),
      "All wattage should be >= min"
    );
  });

  await t.test("should support wattage_max only", () => {
    const results = searchComponentsMock({
      type: "psu",
      wattage_max: 750,
    });

    assert(results.length > 0, "Should find PSUs with wattage <= 750");
    assert(
      results.every((c) => (c.wattage || 0) <= 750),
      "All wattage should be <= max"
    );
  });

  await t.test("should return empty when min > max", () => {
    const results = searchComponentsMock({
      type: "psu",
      wattage_min: 1000,
      wattage_max: 500,
    });

    assert.equal(results.length, 0, "Should return empty when min > max");
  });

  await t.test("should skip non-PSU types", () => {
    const results = searchComponentsMock({
      type: "cpu",
      wattage_min: 500,
    });

    assert.equal(results.length, 0, "CPU should not match wattage filter");
  });

  await t.test("should include boundary values", () => {
    const allPSUs = searchComponentsMock({ type: "psu" });
    if (allPSUs.length > 0) {
      const testWattage = allPSUs[0].wattage;

      const results = searchComponentsMock({
        type: "psu",
        wattage_min: testWattage,
        wattage_max: testWattage,
      });

      assert(
        results.some((c) => c.id === allPSUs[0].id),
        "Should include PSU with exact wattage"
      );
    }
  });

  await t.test("should work with other filters combined", () => {
    const results = searchComponentsMock({
      type: "psu",
      wattage_min: 650,
      wattage_max: 1000,
      stock_status: "in_stock",
      price_max: 3000000,
    });

    assert(
      results.every(
        (c) =>
          c.type === "psu" &&
          (c.wattage || 0) >= 650 &&
          (c.wattage || 0) <= 1000 &&
          c.stock_status === "in_stock" &&
          c.price <= 3000000
      ),
      "Should apply all filters together"
    );
  });

  await t.test("should handle zero wattage", () => {
    const results = searchComponentsMock({
      type: "psu",
      wattage_min: 0,
    });

    assert(results.length > 0, "Should find PSUs with wattage >= 0");
    assert(
      results.every((c) => (c.wattage || 0) >= 0),
      "All should have wattage >= 0"
    );
  });
});
