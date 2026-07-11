/**
 * Test transformer with real API data
 * Run: npx tsx scripts/test-transform.ts
 */

import { transformPhongVuProduct } from "../src/phongvu-transformer.js";

const API_ENDPOINT = "https://discovery.tekoapis.com/api/v2/search-skus-v2";

async function testTransform() {
  console.log("Testing PhongVu Transformer with Real Data...\n");

  const body = {
    terminalId: 4,
    slug: "/c/cpu",
    query: "",
    sorting: {
      sort: "SORT_BY_UNSPECIFIED",
      order: "ORDER_BY_UNSPECIFIED",
    },
    filter: {
      priceGte: 1500000,
      priceLte: 43500000,
    },
    pageSize: 3,
    page: 1,
    isNeedFeaturedProducts: false,
  };

  try {
    const response = await fetch(API_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!data.data?.products) {
      console.error("No products in response");
      return;
    }

    console.log(`Fetched ${data.data.products.length} products from API\n`);

    // Transform first 3 products
    data.data.products.slice(0, 3).forEach((product: any, i: number) => {
      console.log(`\n--- Product ${i + 1} ---`);
      console.log(`Raw: ${product.name}`);

      const transformed = transformPhongVuProduct(product, "cpu");

      if (transformed) {
        console.log(`✅ Transformed to Component:`);
        console.log(JSON.stringify(transformed, null, 2));
      } else {
        console.log(`❌ Failed to transform`);
      }
    });
  } catch (error) {
    console.error("Error:", error);
  }
}

testTransform();
