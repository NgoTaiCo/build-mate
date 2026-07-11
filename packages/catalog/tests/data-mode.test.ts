import { test } from "node:test";
import assert from "node:assert/strict";
import { getCatalogDataMode } from "../src/config.js";
import { clearCatalogCache } from "../src/data-loader.js";
import { searchComponents } from "../src/index.js";

function withEnv(value: string | undefined, fn: () => Promise<void> | void) {
  const prev = process.env.CATALOG_DATA_SOURCE;
  if (value === undefined) delete process.env.CATALOG_DATA_SOURCE;
  else process.env.CATALOG_DATA_SOURCE = value;
  clearCatalogCache();
  return (async () => {
    try {
      await fn();
    } finally {
      if (prev === undefined) delete process.env.CATALOG_DATA_SOURCE;
      else process.env.CATALOG_DATA_SOURCE = prev;
      clearCatalogCache();
    }
  })();
}

test("getCatalogDataMode", async (t) => {
  await t.test("defaults to phongvu when unset or invalid", () => {
    return withEnv(undefined, () => {
      assert.equal(getCatalogDataMode(), "phongvu");
    }).then(() =>
      withEnv("garbage", () => {
        assert.equal(getCatalogDataMode(), "phongvu");
      }),
    );
  });

  await t.test("reads live / mock / phongvu case-insensitively", async () => {
    await withEnv("LIVE", () => assert.equal(getCatalogDataMode(), "live"));
    await withEnv("Mock", () => assert.equal(getCatalogDataMode(), "mock"));
    await withEnv("phongvu", () => assert.equal(getCatalogDataMode(), "phongvu"));
  });
});

test("searchComponents source labeling", async (t) => {
  await t.test("default (phongvu) serves the full PhongVu catalog", async () => {
    await withEnv("phongvu", async () => {
      const result = await searchComponents({ type: "cpu" });
      assert.equal(result.source, "phongvu");
      assert.ok(result.components.length > 50, "PhongVu catalog is large");
    });
  });

  await t.test("mock mode serves only the small bundled MOCK_CATALOG", async () => {
    await withEnv("mock", async () => {
      const result = await searchComponents({ type: "cpu" });
      assert.equal(result.source, "mock");
      assert.ok(result.components.length < 50, "MOCK_CATALOG is small");
    });
  });
});
