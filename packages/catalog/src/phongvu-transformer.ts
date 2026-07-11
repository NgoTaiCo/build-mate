import { CatalogComponent, ComponentType } from "./types.js";

export interface PhongVuProduct {
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
    return isNaN(parsed) || parsed <= 0 ? null : parsed;
  } catch {
    return null;
  }
}

export function extractSharedFields(product: PhongVuProduct): ExtractedFields {
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

  const text = extractText(
    product.highlight || product.shortDescription || product.name
  );
  const textUpper = text.toUpperCase();

  // Socket is OPTIONAL: the Compiler only checks cooler height vs case
  // clearance (E004), never the cooler socket. PhongVu cooler descriptions
  // rarely list sockets, so requiring one dropped 100% of coolers.
  const socketMatch = textUpper.match(/SOCKET[:\s]+([\w\d,\s]+?)(?:\s*\/|\s+TDP|$)/);
  let socket: string[] | undefined;
  if (socketMatch) {
    const sockets = socketMatch[1]
      .split(/[,\/]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && /[\w\d]/.test(s));
    if (sockets.length > 0) socket = sockets;
  }

  const tdpMatch = textUpper.match(/TDP[\s:]*(\d+)\s*W/);
  const tdp = tdpMatch ? parseInt(tdpMatch[1], 10) : 200;

  // Height drives the only cooler compatibility check. When the description
  // doesn't state it, default by cooler kind: AIO/liquid coolers mount a low
  // block on the socket (rarely a clearance problem), tower air coolers are tall.
  const isLiquid = /tản nước|nước|aio|liquid|water/i.test(text);
  const heightMatch = textUpper.match(
    /(?:CAO|HEIGHT|CHIỀU CAO)[:\s]*(\d{2,3})\s*MM|(\d{2,3})\s*MM\s*(?:CAO|HEIGHT)/
  );
  const height = heightMatch
    ? parseInt(heightMatch[1] || heightMatch[2], 10)
    : isLiquid
      ? 60
      : 158;

  const result = {
    ...shared,
    type: "cooler" as const,
    tdp,
    height,
  } as CatalogComponent;
  if (socket) result.socket = socket;
  return result;
}

// A case supports its own form factor plus every smaller one.
export const FORM_FACTOR_ORDER = ["E-ATX", "ATX", "mATX", "ITX"] as const;

export function normalizeFormFactor(raw: string): "E-ATX" | "ATX" | "mATX" | "ITX" {
  const u = raw.toUpperCase().replace(/[\s-]/g, "");
  if (u === "EATX") return "E-ATX";
  if (u === "MICROATX" || u === "MATX") return "mATX";
  if (u === "MINIITX" || u === "ITX") return "ITX";
  return "ATX";
}

export function supportedMbFormFactors(caseFf: "E-ATX" | "ATX" | "mATX" | "ITX"): string[] {
  const idx = FORM_FACTOR_ORDER.indexOf(caseFf);
  // Everything from the case's size on down; drop E-ATX from the mainboard
  // list since Compiler mainboards are ATX/mATX/ITX.
  return FORM_FACTOR_ORDER.slice(idx).filter((f) => f !== "E-ATX");
}

function extractCase(product: PhongVuProduct): CatalogComponent | null {
  const shared = extractSharedFields(product);
  if (!shared) return null;

  const text = extractText(
    product.highlight || product.shortDescription || product.name
  );
  const textUpper = text.toUpperCase();

  // form_factor is OPTIONAL: the Compiler validates a case via
  // supported_mb_form_factors / supported_psu_form_factors / max_cooler_height,
  // not the case's own size label. Default to a mid-tower ATX when unstated.
  const formFactorMatch = text.match(
    /(E-?ATX|Micro-?ATX|mATX|Mini-?ITX|ITX|ATX)/i
  );
  const form_factor = normalizeFormFactor(
    formFactorMatch ? formFactorMatch[1] : "ATX"
  );

  const supported_mb_form_factors = supportedMbFormFactors(form_factor);
  const supported_psu_form_factors = /SFX/i.test(text)
    ? ["SFX", "ATX"]
    : ["ATX"];

  // CPU-cooler clearance (max_cooler_height) if stated, else a mid-tower default.
  const coolerHeightMatch = textUpper.match(
    /(?:TẢN|COOLER|CPU)[^\d]{0,24}(\d{2,3})\s*MM|(\d{2,3})\s*MM[^\d]{0,10}(?:TẢN|COOLER|CPU)/
  );
  const max_cooler_height = coolerHeightMatch
    ? parseInt(coolerHeightMatch[1] || coolerHeightMatch[2], 10)
    : 160;

  // GPU length clearance.
  const clearanceMatch = text.match(
    /GPU\s*[Cc]learance[\s:]*(\d+)\s*mm|clearance[\s:]*(\d+)\s*mm|(\d{3})\s*mm/i
  );
  const clearance_mm = clearanceMatch
    ? parseInt(clearanceMatch[1] || clearanceMatch[2] || clearanceMatch[3], 10)
    : 330;

  return {
    ...shared,
    type: "case" as const,
    form_factor,
    supported_mb_form_factors,
    supported_psu_form_factors,
    max_cooler_height,
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
