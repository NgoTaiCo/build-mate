import { CatalogComponent, ComponentType } from "./types.js";

interface PhongVuProduct {
  sku: string;
  name: string;
  latestPrice: string;
  totalAvailable?: number | null;
  discountPercent?: number;
  shortDescription: string;
  highlight?: string;
  categories?: Array<{ name: string }>;
}

type ExtractedFields = Partial<CatalogComponent>;

function extractText(html?: string): string {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function parsePrice(priceStr: string | number): number | null {
  try {
    const cleaned =
      typeof priceStr === "string"
        ? priceStr.replace(/[^0-9]/g, "")
        : String(priceStr);
    const parsed = parseInt(cleaned, 10);
    return isNaN(parsed) || parsed < 0 ? null : parsed;
  } catch {
    return null;
  }
}

function extractSharedFields(product: PhongVuProduct): ExtractedFields {
  const price = parsePrice(product.latestPrice);
  if (price === null) return null as any;

  return {
    sku: product.sku,
    name: product.name,
    price,
    stock_status:
      product.totalAvailable == null || product.totalAvailable === 0
        ? ("out_of_stock" as const)
        : ("in_stock" as const),
    promo:
      product.discountPercent && product.discountPercent > 0
        ? `${product.discountPercent}% discount`
        : null,
  };
}

function extractCpu(product: PhongVuProduct): CatalogComponent | null {
  const shared = extractSharedFields(product);
  if (!shared) return null;

  const text = extractText(
    product.highlight || product.shortDescription
  ).toUpperCase();

  const socketMatch = text.match(/SOCKET\s*([\w\d]+)/);
  const tdpMatch = text.match(/TDP[\s:]*(\d+)\s*W/);

  if (!socketMatch) return null;

  const socket = socketMatch[1];
  const tdp = tdpMatch ? parseInt(tdpMatch[1], 10) : 65;

  return {
    ...shared,
    type: "cpu" as const,
    socket,
    tdp,
  } as CatalogComponent;
}

function extractMainboard(product: PhongVuProduct): CatalogComponent | null {
  const shared = extractSharedFields(product);
  if (!shared) return null;

  const text = extractText(
    product.highlight || product.shortDescription
  ).toUpperCase();

  const socketMatch = text.match(/SOCKET\s*([\w\d]+)/);
  const ramGenMatch = text.match(/(DDR[45])/);
  const formFactorMatch = text.match(/(ATX|mATX|ITX)/);

  if (!socketMatch || !ramGenMatch || !formFactorMatch) return null;

  return {
    ...shared,
    type: "mainboard" as const,
    socket: socketMatch[1],
    ram_gen: ramGenMatch[1] as "DDR4" | "DDR5",
    form_factor: formFactorMatch[1] as "ATX" | "mATX" | "ITX",
  } as CatalogComponent;
}

function extractRam(product: PhongVuProduct): CatalogComponent | null {
  const shared = extractSharedFields(product);
  if (!shared) return null;

  const text = extractText(
    product.highlight || product.shortDescription || product.name
  ).toUpperCase();

  const ramGenMatch = text.match(/(DDR[45])/);

  if (!ramGenMatch) return null;

  return {
    ...shared,
    type: "ram" as const,
    ram_gen: ramGenMatch[1] as "DDR4" | "DDR5",
  } as CatalogComponent;
}

function extractPsu(product: PhongVuProduct): CatalogComponent | null {
  const shared = extractSharedFields(product);
  if (!shared) return null;

  const text = extractText(
    product.highlight || product.shortDescription
  ).toUpperCase();

  const wattageMatch = text.match(/(\d+)\s*W(?:ATT)?/);
  const formFactorMatch = text.match(/(ATX|SFX)/);

  if (!wattageMatch) return null;

  const wattage = parseInt(wattageMatch[1], 10);
  const form_factor = (formFactorMatch ? formFactorMatch[1] : "ATX") as
    | "ATX"
    | "SFX";

  return {
    ...shared,
    type: "psu" as const,
    wattage,
    form_factor,
  } as CatalogComponent;
}

function extractCooler(product: PhongVuProduct): CatalogComponent | null {
  const shared = extractSharedFields(product);
  if (!shared) return null;

  const text = extractText(product.highlight || product.shortDescription);
  const textUpper = text.toUpperCase();

  // Match socket list - capture until "/" or "TDP" or end
  const socketMatch = textUpper.match(/SOCKET[:\s]+([\w\d,\s]+?)(?:\s*\/|\s+TDP|$)/);
  const tdpMatch = textUpper.match(/TDP[\s:]*(\d+)\s*W/);

  if (!socketMatch) return null;

  const sockets = socketMatch[1]
    .split(/[,\/]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && /[\w\d]/.test(s));

  if (sockets.length === 0) return null;

  const tdp = tdpMatch ? parseInt(tdpMatch[1], 10) : 200;

  return {
    ...shared,
    type: "cooler" as const,
    socket: sockets,
    tdp,
  } as CatalogComponent;
}

function extractCase(product: PhongVuProduct): CatalogComponent | null {
  const shared = extractSharedFields(product);
  if (!shared) return null;

  const text = extractText(product.highlight || product.shortDescription);

  const formFactorMatch = text.match(/(ATX|mATX|ITX)/);
  const clearanceMatch = text.match(/clearance[\s:]*(\d+)\s*mm|(\d+)\s*mm\s*clear|GPU\s*[Cc]learance[\s:]*(\d+)\s*mm/i);

  if (!formFactorMatch) return null;

  const form_factor = formFactorMatch[1] as "ATX" | "mATX" | "ITX";
  const clearance_mm = clearanceMatch
    ? parseInt(clearanceMatch[1] || clearanceMatch[2] || clearanceMatch[3], 10)
    : 300;

  return {
    ...shared,
    type: "case" as const,
    form_factor,
    clearance_mm,
  } as CatalogComponent;
}

function extractStorage(product: PhongVuProduct): CatalogComponent | null {
  const shared = extractSharedFields(product);
  if (!shared) return null;

  return {
    ...shared,
    type: "storage" as const,
  } as CatalogComponent;
}

function extractGpu(product: PhongVuProduct): CatalogComponent | null {
  const shared = extractSharedFields(product);
  if (!shared) return null;

  // Try shortDescription first (more detailed), then highlight
  const text = extractText(product.shortDescription || product.highlight);
  const textUpper = text.toUpperCase();

  const tdpMatch = textUpper.match(/TDP[\s:]*(\d+)\s*W|POWER[\s:]*(\d+)\s*W/);
  const clearanceMatch = textUpper.match(/LENGTH[\s:]*(\d+)\s*MM|(\d+)\s*MM\s*LENGTH|(\d+)\s*MM\s*(?=\)|,|$)/);

  const tdp = tdpMatch ? parseInt(tdpMatch[1] || tdpMatch[2], 10) : 300;
  const clearance_mm = clearanceMatch
    ? parseInt(clearanceMatch[1] || clearanceMatch[2] || clearanceMatch[3], 10)
    : 300;

  return {
    ...shared,
    type: "gpu" as const,
    tdp,
    clearance_mm,
  } as CatalogComponent;
}

const extractors: Record<
  ComponentType,
  (product: PhongVuProduct) => CatalogComponent | null
> = {
  cpu: extractCpu,
  mainboard: extractMainboard,
  ram: extractRam,
  psu: extractPsu,
  cooler: extractCooler,
  case: extractCase,
  storage: extractStorage,
  gpu: extractGpu,
};

export function transformPhongVuProduct(
  product: PhongVuProduct,
  type: ComponentType
): CatalogComponent | null {
  const extractor = extractors[type];
  if (!extractor) return null;
  return extractor(product);
}

export function transformPhongVuProducts(
  products: PhongVuProduct[],
  type: ComponentType
): CatalogComponent[] {
  return products
    .map((p) => transformPhongVuProduct(p, type))
    .filter((c) => c !== null) as CatalogComponent[];
}
