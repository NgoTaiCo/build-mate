import { writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { transformPhongVuProduct } from "../src/phongvu-transformer.js";
import { transformPhongVuDetail, toAttrMap } from "../src/phongvu-detail.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface PhongVuProduct {
  sku: string;
  name: string;
  latestPrice: string;
  totalAvailable?: number | null;
  discountPercent?: number;
  shortDescription: string;
  highlight?: string;
}

interface ApiResponse {
  code: number;
  data?: {
    products: PhongVuProduct[];
  };
  message?: string;
}

type ComponentType =
  | "cpu"
  | "mainboard"
  | "ram"
  | "psu"
  | "cooler"
  | "case"
  | "storage"
  | "gpu";

const TYPE_SLUGS: Record<ComponentType, string[]> = {
  cpu: ["/c/cpu"],
  mainboard: ["/c/mainboard-bo-mach-chu"],
  ram: ["/c/ram-pc"],
  psu: ["/c/psu-nguon-may-tinh"],
  cooler: ["/c/tan-nhiet"],
  case: ["/c/case"],
  storage: ["/c/o-cung-hdd", "/c/o-cung-ssd"],
  gpu: ["/c/vga-card-man-hinh"],
};

const API_ENDPOINT = "https://discovery.tekoapis.com/api/v2/search-skus-v2";
const DETAIL_ENDPOINT = "https://discovery.tekoapis.com/api/v1/product";
const PAGE_SIZE = 50;
const DETAIL_CONCURRENCY = 8;

async function fetchProductDetailAttrs(sku: string): Promise<any[] | null> {
  try {
    const res = await fetch(
      `${DETAIL_ENDPOINT}?sku=${encodeURIComponent(sku)}&location=&terminalCode=phongvu`,
    );
    if (!res.ok) return null;
    const data = (await res.json()) as any;
    return data?.result?.product?.productDetail?.attributes ?? null;
  } catch {
    return null;
  }
}

// Run an async worker over items with a fixed concurrency cap.
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function run(): Promise<void> {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i], i);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => run()),
  );
  return results;
}


async function fetchPhongVuPage(
  slug: string,
  page: number
): Promise<PhongVuProduct[]> {
  const body = {
    terminalId: 4,
    slug,
    query: "",
    sorting: {
      sort: "SORT_BY_UNSPECIFIED",
      order: "ORDER_BY_UNSPECIFIED",
    },
    filter: {},
    pageSize: PAGE_SIZE,
    page,
    isNeedFeaturedProducts: false,
  };

  const response = await fetch(API_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as ApiResponse;

  if (data.code !== 200 || !data.data?.products) {
    console.warn(`API returned non-200 status or no products for ${slug}`);
    return [];
  }

  return data.data.products;
}

async function fetchAllPages(
  slug: string
): Promise<PhongVuProduct[]> {
  const allProducts: PhongVuProduct[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    try {
      console.log(`  Fetching ${slug} page ${page}...`);
      const products = await fetchPhongVuPage(slug, page);

      if (products.length === 0 || products.length < PAGE_SIZE) {
        hasMore = false;
      }

      allProducts.push(...products);
      page++;

      if (page > 100) {
        console.warn(`  Hit page limit (10), stopping for safety`);
        hasMore = false;
      }
    } catch (error) {
      console.error(`  Error fetching ${slug} page ${page}:`, error);
      hasMore = false;
    }
  }

  return allProducts;
}

async function ensureDataDir(): Promise<string> {
  const dataDir = resolve(__dirname, "../data");
  mkdirSync(dataDir, { recursive: true });
  return dataDir;
}

async function fetchAndSaveType(
  type: ComponentType,
  dataDir: string
): Promise<void> {
  const slugs = TYPE_SLUGS[type];
  console.log(`\nFetching ${type.toUpperCase()}...`);

  let allProducts: PhongVuProduct[] = [];

  for (const slug of slugs) {
    const products = await fetchAllPages(slug);
    allProducts.push(...products);
  }

  // Enrich each product with the structured detail API, then map. Fall back to
  // the list-based (regex) transform if a detail request fails.
  console.log(`  Fetching detail for ${allProducts.length} products...`);
  let detailHits = 0;
  const transformed = (
    await mapWithConcurrency(allProducts, DETAIL_CONCURRENCY, async (product) => {
      const attributes = await fetchProductDetailAttrs(product.sku);
      if (attributes) {
        const fromDetail = transformPhongVuDetail(
          product,
          type,
          toAttrMap(attributes),
        );
        if (fromDetail) {
          detailHits++;
          return fromDetail;
        }
      }
      return transformPhongVuProduct(product, type);
    })
  ).filter((component) => component !== null);
  console.log(`  Mapped ${detailHits} via detail API, rest via list fallback`);

  const filePath = resolve(dataDir, `phongvu-catalog-${type}.json`);
  writeFileSync(filePath, JSON.stringify(transformed, null, 2));
  console.log(
    `  ✓ Saved ${transformed.length} transformed products to ${filePath}`
  );

  const dropped = allProducts.length - transformed.length;
  if (dropped > 0) {
    // Distinguish the two drop reasons so the count isn't misread as a bug:
    // unpriced items (latestPrice "0") are intentionally skipped, whereas
    // priced-but-unparseable items point at a transformer gap worth fixing.
    const noPrice = allProducts.filter(
      (p) => !p.latestPrice || parseInt(String(p.latestPrice).replace(/[^0-9]/g, ""), 10) <= 0
    ).length;
    const noSpecs = dropped - noPrice;
    console.log(
      `  ⚠️  Filtered out ${dropped} products (${noPrice} without a price, ${noSpecs} with unparseable specs)`
    );
  }
}

async function main(): Promise<void> {
  try {
    console.log("Fetching PhongVu catalog data...\n");
    console.log(`API Endpoint: ${API_ENDPOINT}\n`);

    const dataDir = await ensureDataDir();

    const types: ComponentType[] = [
      "cpu",
      "mainboard",
      "ram",
      "psu",
      "cooler",
      "case",
      "storage",
      "gpu",
    ];

    for (const type of types) {
      await fetchAndSaveType(type, dataDir);
    }

    console.log("\n✅ All catalog data fetched successfully!");
  } catch (error) {
    console.error("❌ Failed to fetch catalog:", error);
    process.exit(1);
  }
}

main();
