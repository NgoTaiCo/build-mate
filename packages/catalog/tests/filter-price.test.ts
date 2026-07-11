import { test } from "node:test";
import assert from "node:assert/strict";
import { searchComponentsMock } from "../src/index.js";

test("price filter", async (t) => {
  await t.test("should filter by inclusive price range", () => {
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

  await t.test("should support min price only", () => {
    const results = searchComponentsMock({
      type: "cpu",
      price_min: 5000000,
    });

    assert(
      results.every((c) => c.price >= 5000000),
      "All prices should be >= min"
    );
  });

  await t.test("should support max price only", () => {
    const results = searchComponentsMock({
      type: "cpu",
      price_max: 6000000,
    });

    assert(
      results.every((c) => c.price <= 6000000),
      "All prices should be <= max"
    );
  });

  await t.test("should return empty when min > max", () => {
    const results = searchComponentsMock({
      type: "cpu",
      price_min: 10000000,
      price_max: 5000000,
    });

    assert.equal(results.length, 0, "Should return empty when min > max");
  });

  await t.test("should include boundary values", () => {
    // Find a CPU and use its exact price as boundary
    const allCPUs = searchComponentsMock({ type: "cpu" });
    const testPrice = allCPUs[0].price;

    const results = searchComponentsMock({
      type: "cpu",
      price_min: testPrice,
      price_max: testPrice,
    });

    assert(
      results.some((c) => c.sku === allCPUs[0].sku),
      "Should include component with exact price"
    );
  });

  await t.test("should not match when outside range", () => {
    const results = searchComponentsMock({
      type: "cpu",
      price_min: 1000000000,
      price_max: 2000000000,
    });

    assert.equal(results.length, 0, "No CPUs should be this expensive");
  });

  await t.test("should handle zero price", () => {
    const results = searchComponentsMock({
      type: "cpu",
      price_min: 0,
    });

    assert(results.length > 0, "Should find CPUs with price >= 0");
    assert(
      results.every((c) => c.price >= 0),
      "All prices should be >= 0"
    );
  });

  await t.test("should work with other filters combined", () => {
    const results = searchComponentsMock({
      type: "mainboard",
      socket: "AM5",
      price_min: 3000000,
      price_max: 4500000,
    });

    assert(
      results.every(
        (c) =>
          c.type === "mainboard" &&
          c.socket === "AM5" &&
          c.price >= 3000000 &&
          c.price <= 4500000
      ),
      "Should apply all filters together"
    );
  });
});
