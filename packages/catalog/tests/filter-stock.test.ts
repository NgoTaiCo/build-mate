import { test } from "node:test";
import assert from "node:assert/strict";
import { searchComponentsMock } from "../src/index.js";

test("stock filter", async (t) => {
  await t.test("should filter for in_stock only", () => {
    const results = searchComponentsMock({
      type: "gpu",
      stock_status: "in_stock",
    });

    assert(results.length > 0, "Should find in_stock GPUs");
    assert(
      results.every((c) => c.stock_status === "in_stock"),
      "All results should be in_stock"
    );
  });

  await t.test("should filter for out_of_stock only", () => {
    const results = searchComponentsMock({
      type: "gpu",
      stock_status: "out_of_stock",
    });

    assert(results.length > 0, "Should find out_of_stock GPUs");
    assert(
      results.every((c) => c.stock_status === "out_of_stock"),
      "All results should be out_of_stock"
    );
  });

  await t.test("should return both statuses when filter not specified", () => {
    const all = searchComponentsMock({ type: "gpu" });
    const inStock = searchComponentsMock({
      type: "gpu",
      stock_status: "in_stock",
    });
    const outOfStock = searchComponentsMock({
      type: "gpu",
      stock_status: "out_of_stock",
    });

    assert(
      inStock.length + outOfStock.length === all.length,
      "in_stock + out_of_stock should equal total"
    );
  });

  await t.test("should return empty for unknown status value", () => {
    const results = searchComponentsMock({
      type: "gpu",
      stock_status: "unknown" as any,
    });

    assert.equal(results.length, 0, "Should return empty for unknown status");
  });

  await t.test("should work with multiple filters", () => {
    const results = searchComponentsMock({
      type: "cpu",
      socket: "AM5",
      stock_status: "in_stock",
    });

    assert(
      results.every(
        (c) =>
          c.type === "cpu" &&
          c.socket === "AM5" &&
          c.stock_status === "in_stock"
      ),
      "Should apply all filters together"
    );
  });

  await t.test("should have at least one component of each status per type", () => {
    const types = ["cpu", "mainboard", "ram", "psu", "cooler", "case", "storage", "gpu"];

    for (const type of types) {
      const inStock = searchComponentsMock({
        type: type as any,
        stock_status: "in_stock",
      });
      const outOfStock = searchComponentsMock({
        type: type as any,
        stock_status: "out_of_stock",
      });

      assert(inStock.length > 0, `${type} should have in_stock items`);
      assert(outOfStock.length > 0, `${type} should have out_of_stock items`);
    }
  });
});
