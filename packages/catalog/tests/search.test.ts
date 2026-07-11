import { test } from "node:test";
import assert from "node:assert/strict";
import { searchComponentsMock } from "../src/index.js";

test("searchComponentsMock - combined search", async (t) => {
  await t.test("should return all components for empty criteria", () => {
    const results = searchComponentsMock({});
    assert(results.length > 0, "Should return some components");
  });

  await t.test("should filter by single type", () => {
    const results = searchComponentsMock({ type: "cpu" });
    assert(results.length > 0, "Should find CPUs");
    assert(
      results.every((c) => c.type === "cpu"),
      "All results should be CPUs"
    );
  });

  await t.test("should apply multiple criteria with AND logic", () => {
    const results = searchComponentsMock({
      type: "mainboard",
      socket: "AM5",
      ram_gen: "DDR5",
      stock_status: "in_stock",
    });

    assert(
      results.every((c) => c.type === "mainboard"),
      "All results should be mainboards"
    );
    assert(
      results.every((c) => c.socket === "AM5"),
      "All results should be AM5"
    );
    assert(
      results.every((c) => c.ram_gen === "DDR5"),
      "All results should support DDR5"
    );
    assert(
      results.every((c) => c.stock_status === "in_stock"),
      "All results should be in stock"
    );
  });

  await t.test("should handle price range filter", () => {
    const results = searchComponentsMock({
      type: "cpu",
      price_min: 5000000,
      price_max: 10000000,
    });

    assert(
      results.every((c) => c.price >= 5000000 && c.price <= 10000000),
      "All prices should be within range"
    );
  });

  await t.test("should return empty array for conflicting criteria", () => {
    const results = searchComponentsMock({
      type: "cpu",
      price_min: 1000000000, // unrealistic price
      price_max: 2000000000,
    });

    assert.equal(results.length, 0, "Should return empty array for no match");
  });

  await t.test("should return empty array for unknown type", () => {
    const results = searchComponentsMock({
      type: "invalid" as any,
    });

    assert.equal(results.length, 0, "Should return empty array for unknown type");
  });

  await t.test("should ignore missing criteria fields", () => {
    const allResults = searchComponentsMock({});
    const socketFilteredResults = searchComponentsMock({ socket: "AM5" });

    assert(
      socketFilteredResults.length < allResults.length,
      "Socket filter should narrow results"
    );
    assert(
      socketFilteredResults.every(
        (c) =>
          c.type === "cpu" ||
          c.type === "mainboard" ||
          c.type === "cooler"
      ),
      "Socket filter should only return relevant types"
    );
  });

  await t.test("should handle stock_status filter", () => {
    const all = searchComponentsMock({});
    const inStock = searchComponentsMock({ stock_status: "in_stock" });
    const outOfStock = searchComponentsMock({
      stock_status: "out_of_stock",
    });

    assert(
      inStock.every((c) => c.stock_status === "in_stock"),
      "All in_stock results should have in_stock status"
    );
    assert(
      outOfStock.every((c) => c.stock_status === "out_of_stock"),
      "All out_of_stock results should have out_of_stock status"
    );
    assert(
      inStock.length + outOfStock.length === all.length,
      "in_stock + out_of_stock should equal total"
    );
  });

  await t.test("should handle unknown type gracefully", () => {
    const results = searchComponentsMock({ type: "unknown" as any });
    assert.equal(results.length, 0, "Unknown type should return empty array");
  });

  await t.test("should never return null for empty results", () => {
    const results = searchComponentsMock({
      type: "cpu",
      price_min: 999999999,
    });

    assert(Array.isArray(results), "Should always return an array");
    assert(results.length === 0, "Should return empty array, not null");
  });
});
