import { test } from "node:test";
import assert from "node:assert/strict";
import { searchComponentsMock } from "../src/index.js";

test("form factor filter", async (t) => {
  await t.test("should filter cases hierarchically - mATX includes ATX+mATX", () => {
    const results = searchComponentsMock({
      type: "case",
      form_factor: "mATX",
    });

    assert(results.length > 0, "Should find mATX cases");
    assert(
      results.every(
        (c) =>
          c.form_factor === "mATX" || c.form_factor === "ATX"
      ),
      "mATX should match mATX and ATX cases"
    );
  });

  await t.test("should filter cases hierarchically - ITX includes all", () => {
    const results = searchComponentsMock({
      type: "case",
      form_factor: "ITX",
    });

    assert(results.length > 0, "Should find ITX cases");
    assert(
      results.every(
        (c) =>
          c.form_factor === "ITX" ||
          c.form_factor === "mATX" ||
          c.form_factor === "ATX"
      ),
      "ITX should match all form factors"
    );
  });

  await t.test("should filter cases hierarchically - ATX matches only ATX", () => {
    const results = searchComponentsMock({
      type: "case",
      form_factor: "ATX",
    });

    assert(results.length > 0, "Should find ATX cases");
    assert(
      results.every((c) => c.form_factor === "ATX"),
      "ATX should match only ATX cases"
    );
  });

  await t.test("should filter mainboards by exact match", () => {
    const results = searchComponentsMock({
      type: "mainboard",
      form_factor: "mATX",
    });

    assert(
      results.every((c) => c.form_factor === "mATX"),
      "Mainboard form_factor should be exact match, not hierarchical"
    );
  });

  await t.test("should ignore form_factor filter for non-case/mainboard types", () => {
    const results = searchComponentsMock({
      type: "psu",
      form_factor: "ATX",
    });

    assert.equal(
      results.length,
      0,
      "PSU should not match form_factor filter"
    );
  });

  await t.test("should return empty for unknown form_factor", () => {
    const results = searchComponentsMock({
      type: "case",
      form_factor: "UNKNOWN",
    });

    assert.equal(results.length, 0, "Should return empty for unknown form_factor");
  });

  await t.test("should work with other filters combined", () => {
    const results = searchComponentsMock({
      type: "case",
      form_factor: "mATX",
      price_min: 500000,
      price_max: 2000000,
    });

    assert(
      results.every(
        (c) =>
          c.type === "case" &&
          (c.form_factor === "mATX" || c.form_factor === "ATX") &&
          c.price >= 500000 &&
          c.price <= 2000000
      ),
      "Should apply all filters together"
    );
  });

  await t.test("should distinguish hierarchical (case) from exact (mainboard)", () => {
    const mATXCases = searchComponentsMock({
      type: "case",
      form_factor: "mATX",
    });
    const mATXMainboards = searchComponentsMock({
      type: "mainboard",
      form_factor: "mATX",
    });

    // mATX cases should include ATX cases
    const hasATXCases = mATXCases.some((c) => c.form_factor === "ATX");
    // mATX mainboards should NOT include ATX
    const hasATXMainboards = mATXMainboards.some((c) => c.form_factor === "ATX");

    assert(
      hasATXCases,
      "mATX case filter should include ATX cases"
    );
    assert(
      !hasATXMainboards,
      "mATX mainboard filter should not include ATX"
    );
  });
});
