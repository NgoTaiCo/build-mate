import { test } from "node:test";
import assert from "node:assert/strict";
import { MOCK_CATALOG } from "../src/mock-data.js";
import { ALL_TYPES } from "../src/types.js";

test("Mock data integrity", async (t) => {
  await t.test("should have at least 5 components per type", () => {
    const byType = new Map<string, number>();

    for (const type of ALL_TYPES) {
      const count = MOCK_CATALOG.filter((c) => c.type === type).length;
      byType.set(type, count);
      assert(count >= 5, `Type '${type}' has ${count} components, expected >= 5`);
    }
  });

  await t.test("should have at least 1 in_stock and 1 out_of_stock per type", () => {
    for (const type of ALL_TYPES) {
      const components = MOCK_CATALOG.filter((c) => c.type === type);
      const inStock = components.filter((c) => c.stock_status === "in_stock");
      const outOfStock = components.filter((c) => c.stock_status === "out_of_stock");

      assert(
        inStock.length >= 1,
        `Type '${type}' has no in_stock components`
      );
      assert(
        outOfStock.length >= 1,
        `Type '${type}' has no out_of_stock components`
      );
    }
  });

  await t.test("should have unique IDs", () => {
    const skus = MOCK_CATALOG.map((c) => c.sku);
    const uniqueSkus = new Set(skus);

    assert.equal(
      skus.length,
      uniqueSkus.size,
      `Found ${skus.length - uniqueSkus.size} duplicate SKUs`
    );
  });

  await t.test("should have all required shared fields non-null", () => {
    for (const component of MOCK_CATALOG) {
      assert(component.sku !== undefined, `Component missing sku`);
      assert(component.name !== undefined, `Component ${component.sku} missing name`);
      assert(component.type !== undefined, `Component ${component.sku} missing type`);
      assert(
        component.price !== undefined && component.price >= 0,
        `Component ${component.sku} missing valid price`
      );
      assert(
        component.stock_status === "in_stock" || component.stock_status === "out_of_stock",
        `Component ${component.sku} has invalid stock_status`
      );
      assert(
        component.promo === null || typeof component.promo === "string",
        `Component ${component.sku} has invalid promo`
      );
    }
  });

  await t.test("should have all type discriminators valid", () => {
    const validTypes = new Set(ALL_TYPES);

    for (const component of MOCK_CATALOG) {
      assert(
        validTypes.has(component.type),
        `Component ${component.sku} has invalid type: '${component.type}'`
      );
    }
  });

  await t.test("should have required type-specific fields", () => {
    for (const component of MOCK_CATALOG) {
      switch (component.type) {
        case "cpu":
          assert(component.socket, `CPU ${component.sku} missing socket`);
          assert(component.tdp !== undefined, `CPU ${component.sku} missing tdp`);
          assert(
            Array.isArray(component.ram_gen_supported),
            `CPU ${component.sku} missing ram_gen_supported`
          );
          break;
        case "mainboard":
          assert(component.socket, `Mainboard ${component.sku} missing socket`);
          assert(
            Array.isArray(component.ram_gen_supported),
            `Mainboard ${component.sku} missing ram_gen_supported`
          );
          assert(component.form_factor, `Mainboard ${component.sku} missing form_factor`);
          break;
        case "ram":
          assert(component.generation, `RAM ${component.sku} missing generation`);
          break;
        case "psu":
          assert(component.wattage !== undefined, `PSU ${component.sku} missing wattage`);
          assert(component.form_factor, `PSU ${component.sku} missing form_factor`);
          break;
        case "cooler":
          assert(Array.isArray(component.socket), `Cooler ${component.sku} socket should be array`);
          assert(component.height !== undefined, `Cooler ${component.sku} missing height`);
          break;
        case "case":
          assert(
            component.max_cooler_height !== undefined,
            `Case ${component.sku} missing max_cooler_height`
          );
          assert(
            Array.isArray(component.supported_mb_form_factors),
            `Case ${component.sku} missing supported_mb_form_factors`
          );
          assert(
            Array.isArray(component.supported_psu_form_factors),
            `Case ${component.sku} missing supported_psu_form_factors`
          );
          break;
        case "gpu":
          assert(component.tdp !== undefined, `GPU ${component.sku} missing tdp`);
          break;
      }
    }
  });
});
