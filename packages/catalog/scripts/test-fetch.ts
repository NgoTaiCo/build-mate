/**
 * Quick test script to verify PhongVu API is accessible
 * Run: npx tsx scripts/test-fetch.ts
 */

const API_ENDPOINT = "https://discovery.tekoapis.com/api/v2/search-skus-v2";

async function testFetch() {
  console.log("Testing PhongVu API (Teko Discovery)...\n");
  console.log(`Endpoint: ${API_ENDPOINT}\n`);

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
    pageSize: 5, // Just get 5 items for testing
    page: 1,
    isNeedFeaturedProducts: false,
  };

  try {
    console.log("Sending request...\n");
    const response = await fetch(API_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    console.log(`Response status: ${response.status}\n`);

    const data = await response.json();

    if (data.code === 200 && data.data?.products) {
      console.log(`✅ Success! Got ${data.data.products.length} products\n`);
      console.log("Sample product:");
      console.log(JSON.stringify(data.data.products[0], null, 2));
    } else {
      console.log(`⚠️ Unexpected response:`);
      console.log(JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

testFetch();
