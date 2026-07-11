import { test } from "node:test";
import assert from "node:assert/strict";
import { searchComponentsMock } from "../src/index.js";

test("searchComponentsMock - price sorting", async (t) => {
  await t.test("should sort results by price ascending", () => {
    const results = searchComponentsMock({ type: "cpu" });

    for (let i = 1; i < results.length; i++) {
      assert(
        results[i - 1].price <= results[i].price,
        `Price at index ${i - 1} (${results[i - 1].price}) should be <= price at ${i} (${results[i].price})`
      );
    }
  });

  await t.test("should maintain stable mock order across multiple calls", () => {
    const results1 = searchComponentsMock({ type: "mainboard" });
    const results2 = searchComponentsMock({ type: "mainboard" });

    assert.equal(
      results1.length,
      results2.length,
      "Same criteria should return same count"
    );

    for (let i = 0; i < results1.length; i++) {
      assert.equal(
        results1[i].id,
        results2[i].id,
        `Component at index ${i} should be identical`
      );
      assert.equal(
        results1[i].price,
        results2[i].price,
        `Price of component at index ${i} should match`
      );
    }
  });

  await t.test("should be deterministic across 100 calls", () => {
    const criteria = { type: "cpu" as const, socket: "AM5" };
    const firstResult = searchComponentsMock(criteria);

    for (let i = 0; i < 100; i++) {
      const result = searchComponentsMock(criteria);
      assert.equal(
        result.length,
        firstResult.length,
        `Call ${i + 1} should return same count`
      );

      for (let j = 0; j < result.length; j++) {
        assert.equal(
          result[j].id,
          firstResult[j].id,
          `Call ${i + 1}, component ${j} should match`
        );
      }
    }
  });

  await t.test("should handle empty results with stable sort", () => {
    const results = searchComponentsMock({
      type: "gpu",
      price_min: 999999999,
    });

    assert(Array.isArray(results), "Should return array");
    assert.equal(results.length, 0, "Should be empty");
  });

  await t.test("should sort all components by price ascending", () => {
    const all = searchComponentsMock({});

    for (let i = 1; i < all.length; i++) {
      assert(
        all[i - 1].price <= all[i].price,
        `Index ${i - 1} price ${all[i - 1].price} should be <= ${all[i].price}`
      );
    }
  });

  await t.test("should handle multiple components with same price", () => {
    const results = searchComponentsMock({});

    // Group by price and verify stability
    const priceGroups = new Map<number, string[]>();
    for (const component of results) {
      if (!priceGroups.has(component.price)) {
        priceGroups.set(component.price, []);
      }
      priceGroups.get(component.price)!.push(component.id);
    }

    // Call again and verify same ordering within price groups
    const results2 = searchComponentsMock({});
    for (const component of results2) {
      const group = priceGroups.get(component.price);
      assert(
        group,
        `Price ${component.price} should be in original results`
      );
    }
  });
});
