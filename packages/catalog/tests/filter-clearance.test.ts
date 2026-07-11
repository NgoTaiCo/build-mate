import { test } from "node:test";
import assert from "node:assert/strict";
import { searchComponentsMock } from "../src/index.js";

test("clearance filter", async (t) => {
  await t.test("should filter by inclusive minimum clearance", () => {
    const results = searchComponentsMock({
      type: "case",
      clearance_mm: 300,
    });

    assert(results.length > 0, "Should find cases with clearance >= 300mm");
    assert(
      results.every((c) => (c.clearance_mm || 0) >= 300),
      "All clearance values should be >= 300"
    );
  });

  await t.test("should use >= not >", () => {
    // Find a case with exact clearance
    const allCases = searchComponentsMock({ type: "case" });
    const testClearance = allCases[0].clearance_mm;

    const results = searchComponentsMock({
      type: "case",
      clearance_mm: testClearance,
    });

    assert(
      results.some((c) => c.clearance_mm === testClearance),
      "Should include components with exact clearance value"
    );
  });

  await t.test("should work with GPUs that have clearance", () => {
    const results = searchComponentsMock({
      type: "gpu",
      clearance_mm: 300,
    });

    assert(
      results.every((c) => (c.clearance_mm || 0) >= 300),
      "All GPUs should have clearance >= 300mm"
    );
  });

  await t.test("should return empty when no component matches clearance", () => {
    const results = searchComponentsMock({
      type: "case",
      clearance_mm: 999999,
    });

    assert.equal(results.length, 0, "Should return empty for impossible clearance");
  });

  await t.test("should skip components without clearance field", () => {
    // Storage doesn't have clearance field
    const results = searchComponentsMock({
      type: "storage",
      clearance_mm: 100,
    });

    assert.equal(
      results.length,
      0,
      "Storage should not match clearance filter"
    );
  });

  await t.test("should work with other filters combined", () => {
    const results = searchComponentsMock({
      type: "case",
      form_factor: "ATX",
      clearance_mm: 300,
      price_max: 4000000,
    });

    assert(
      results.every(
        (c) =>
          c.type === "case" &&
          c.form_factor === "ATX" &&
          (c.clearance_mm || 0) >= 300 &&
          c.price <= 4000000
      ),
      "Should apply all filters together"
    );
  });

  await t.test("should handle clearance of zero", () => {
    const results = searchComponentsMock({
      type: "case",
      clearance_mm: 0,
    });

    assert(
      results.length > 0,
      "Should find cases with clearance >= 0"
    );
    assert(
      results.every((c) => (c.clearance_mm || 0) >= 0),
      "All should have clearance >= 0"
    );
  });
});
