import { writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

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
const PAGE_SIZE = 50;

async function getApiToken(): Promise<string> {
  const configPath = resolve(process.env.HOME || "", ".openclaw/openclaw.json");

  try {
    const config = JSON.parse(
      require("fs").readFileSync(configPath, "utf-8") as string
    );
    if (config.teko_api_key) {
      return config.teko_api_key;
    }
    throw new Error("teko_api_key not found in config");
  } catch (error) {
    console.error("Failed to read API token from ~/.openclaw/openclaw.json");
    console.error("Make sure the file exists and contains teko_api_key");
    throw error;
  }
}

async function fetchPhongVuPage(
  token: string,
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
    filter: {
      priceGte: 1500000,
      priceLte: 43500000,
    },
    pageSize: PAGE_SIZE,
    page,
    isNeedFeaturedProducts: false,
  };

  const response = await fetch(API_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
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
  token: string,
  slug: string
): Promise<PhongVuProduct[]> {
  const allProducts: PhongVuProduct[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    try {
      console.log(`  Fetching ${slug} page ${page}...`);
      const products = await fetchPhongVuPage(token, slug, page);

      if (products.length === 0 || products.length < PAGE_SIZE) {
        hasMore = false;
      }

      allProducts.push(...products);
      page++;

      if (page > 10) {
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
  token: string,
  type: ComponentType,
  dataDir: string
): Promise<void> {
  const slugs = TYPE_SLUGS[type];
  console.log(`\nFetching ${type.toUpperCase()}...`);

  let allProducts: PhongVuProduct[] = [];

  for (const slug of slugs) {
    const products = await fetchAllPages(token, slug);
    allProducts.push(...products);
  }

  const filePath = resolve(dataDir, `phongvu-catalog-${type}.json`);
  writeFileSync(filePath, JSON.stringify(allProducts, null, 2));
  console.log(`  ✓ Saved ${allProducts.length} products to ${filePath}`);
}

async function main(): Promise<void> {
  try {
    console.log("Fetching PhongVu catalog data...\n");

    const token = await getApiToken();
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
      await fetchAndSaveType(token, type, dataDir);
    }

    console.log("\n✅ All catalog data fetched successfully!");
  } catch (error) {
    console.error("❌ Failed to fetch catalog:", error);
    process.exit(1);
  }
}

main();
