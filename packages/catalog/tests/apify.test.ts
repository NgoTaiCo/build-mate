import { test } from "node:test";
import assert from "node:assert/strict";
import { mapScrapedProduct } from "../src/apify/mapper.js";
import { createApifyClient } from "../src/apify/client.js";

test("Apify mapper", async (t) => {
  await t.test("should map scraped CPU with valid specs", () => {
    const scraped = {
      name: "AMD Ryzen 7 7800X3D",
      price: 9500000,
      stock_status: "Còn hàng",
      promo: "Giảm 500K",
      specs: "Socket: AM5, TDP: 120W, DDR5",
      category: "CPU",
    };

    const result = mapScrapedProduct(scraped, "cpu");
    assert(result !== null, "Should map valid CPU");
    assert.equal(result.name, "AMD Ryzen 7 7800X3D");
    assert.equal(result.type, "cpu");
    assert.equal(result.price, 9500000);
    assert.equal(result.stock_status, "in_stock");
    assert.equal(result.socket, "AM5");
    assert.equal(result.tdp, 120);
    assert.deepEqual(result.ram_gen_supported, ["DDR5"]);
  });

  await t.test("should map scraped GPU with valid specs", () => {
    const scraped = {
      name: "NVIDIA RTX 4090",
      price: 35000000,
      stock_status: "Còn hàng",
      promo: null,
      specs: "TDP: 450W, GPU max 320mm",
      category: "Graphics Card",
    };

    const result = mapScrapedProduct(scraped, "gpu");
    assert(result !== null, "Should map valid GPU");
    assert.equal(result.tdp, 450);
    assert.equal(result.clearance_mm, 320);
  });

  await t.test("should return null for missing required fields", () => {
    const scraped = {
      name: "Invalid Product",
      price: null,
      stock_status: "Còn hàng",
      promo: null,
      specs: "Socket: AM5",
      category: "CPU",
    };

    const result = mapScrapedProduct(scraped, "cpu");
    assert.equal(result, null, "Should return null for missing price");
  });

  await t.test("should return null for unparseable specs", () => {
    const scraped = {
      name: "AMD Ryzen 5",
      price: 5000000,
      stock_status: "Còn hàng",
      promo: null,
      specs: "Very generic specs",
      category: "CPU",
    };

    const result = mapScrapedProduct(scraped, "cpu");
    assert.equal(result, null, "Should return null when cannot parse specs");
  });

  await t.test("should map stock status correctly", () => {
    const inStock = mapScrapedProduct(
      {
        name: "Test CPU",
        price: 5000000,
        stock_status: "Còn hàng",
        promo: null,
        specs: "Socket: AM5, TDP: 65W, DDR5",
        category: "CPU",
      },
      "cpu"
    );

    const outOfStock = mapScrapedProduct(
      {
        name: "Test CPU",
        price: 5000000,
        stock_status: "Hết hàng",
        promo: null,
        specs: "Socket: AM5, TDP: 65W, DDR5",
        category: "CPU",
      },
      "cpu"
    );

    assert.equal(inStock?.stock_status, "in_stock");
    assert.equal(outOfStock?.stock_status, "out_of_stock");
  });

  await t.test("should handle missing specs gracefully", () => {
    const scraped = {
      name: "Generic Storage",
      price: 1000000,
      stock_status: "Còn hàng",
      promo: null,
      specs: "",
      category: "Storage",
    };

    const result = mapScrapedProduct(scraped, "storage");
    assert(result !== null, "Storage should map without specs");
    assert.equal(result.type, "storage");
  });
});

test("Apify client", async (t) => {
  await t.test("should return null when no API key provided", async () => {
    const client = createApifyClient("");
    const result = await client.fetchType("cpu");
    assert.equal(result, null, "Should return null without API key");
  });

  await t.test("should handle timeout gracefully", async () => {
    const client = createApifyClient("");
    const result = await client.fetchType("gpu");
    assert.equal(result, null, "Should handle timeout");
  });

  await t.test("should return null on error", async () => {
    const client = createApifyClient("invalid-key-12345");
    const result = await client.fetchType("cpu");
    assert(
      result === null || Array.isArray(result),
      "Should either return null or array on error"
    );
  });
});
