import { CatalogComponent, ComponentType } from "./types.js";
import {
  PhongVuProduct,
  extractSharedFields,
  normalizeFormFactor,
  supportedMbFormFactors,
  cpuRamGenSupported,
} from "./phongvu-transformer.js";

/**
 * Maps the Teko product-detail API (v1/product?sku=...) structured attributes
 * onto CatalogComponent. This is richer and more reliable than parsing the
 * list API's free-text descriptions: sockets, cooler height, case cooler
 * clearance, and GPU length come as first-class attribute values.
 */

export interface DetailAttribute {
  code: string;
  name?: string;
  values?: string[];
}

export type AttrMap = Record<string, string[]>;

export function toAttrMap(attributes: DetailAttribute[] | undefined): AttrMap {
  const map: AttrMap = {};
  for (const a of attributes ?? []) {
    if (a.code && Array.isArray(a.values) && a.values.length > 0) {
      map[a.code] = a.values;
    }
  }
  return map;
}

function first(map: AttrMap, code: string): string | undefined {
  return map[code]?.[0];
}

// "AMD AM5" -> "AM5", "Intel LGA 1700" -> "1700", "Intel LGA 115X" -> "115X".
function normalizeSocket(raw: string): string {
  return raw
    .replace(/AMD|Intel|LGA|Socket/gi, "")
    .replace(/\s+/g, "")
    .trim();
}

// "1600W" -> 1600, "65 W" -> 65.
function parseWatts(raw?: string): number | null {
  if (!raw) return null;
  const m = raw.match(/(\d+)\s*W/i) ?? raw.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

// "165 mm" -> 165, "228mm" -> 228.
function parseMm(raw?: string): number | null {
  if (!raw) return null;
  const m = raw.match(/(\d+(?:\.\d+)?)\s*mm/i) ?? raw.match(/(\d+(?:\.\d+)?)/);
  return m ? Math.round(parseFloat(m[1])) : null;
}

// Physical dimension attributes ("height"/"length"/"width") are centimetres.
function cmToMm(raw?: string): number | null {
  if (!raw) return null;
  const n = parseFloat(raw);
  return isNaN(n) ? null : Math.round(n * 10);
}

function ramGen(raw?: string): "DDR4" | "DDR5" | undefined {
  if (!raw) return undefined;
  const m = raw.toUpperCase().match(/DDR[45]/);
  return m ? (m[0] as "DDR4" | "DDR5") : undefined;
}

// Estimate GPU board power from its auxiliary power connectors (+75W PCIe slot).
// The detail API has no direct card-TDP field; connectors give a realistic
// upper bound, far better than a flat default for PSU sizing.
function gpuTdpFromConnectors(raw?: string): number | null {
  if (!raw) return null;
  const t = raw.toLowerCase();
  if (/12vhpwr|12v-?2x6|16-?pin|16 pin/.test(t)) return 600; // high-end single cable
  const per = (count: number, watts: number) => count * watts;
  let total = 0;
  for (const m of t.matchAll(/(\d+)\s*x\s*(\d+)\s*-?\s*pin/g)) {
    const count = parseInt(m[1], 10);
    const pins = parseInt(m[2], 10);
    total += per(count, pins >= 8 ? 150 : 75);
  }
  if (total === 0) {
    const single = t.match(/(\d+)\s*-?\s*pin/);
    if (single) total = parseInt(single[1], 10) >= 8 ? 150 : 75;
  }
  return total > 0 ? total + 75 : null;
}

/**
 * Build a CatalogComponent from list-provided shared fields + detail attributes.
 * Returns null only when shared fields are invalid (e.g. no price) — spec gaps
 * fall back to sensible defaults rather than dropping the product.
 */
export function transformPhongVuDetail(
  product: PhongVuProduct,
  type: ComponentType,
  attrs: AttrMap,
): CatalogComponent | null {
  const shared = extractSharedFields(product);
  if (!shared) return null;

  switch (type) {
    case "cpu": {
      const socketRaw = first(attrs, "cpu_socket");
      if (!socketRaw) return null; // socket is essential for E001
      const socket = normalizeSocket(socketRaw);
      return {
        ...shared,
        type: "cpu",
        socket,
        tdp: parseWatts(first(attrs, "tieu_thu_dien_nang_cpu")) ?? 65,
        // ram_gen_supported drives the E002 RAM-generation check.
        ram_gen_supported: cpuRamGenSupported(socket),
      } as CatalogComponent;
    }

    case "mainboard": {
      const socket = first(attrs, "mainboard_socket");
      const gen = ramGen(first(attrs, "mainboard_thehebonhohotro"));
      const ff = first(attrs, "mainboard_chuankichthuoc");
      if (!socket || !gen || !ff) return null;
      return {
        ...shared,
        type: "mainboard",
        socket: normalizeSocket(socket),
        ram_gen: gen, // search filter
        ram_gen_supported: [gen], // E002 check
        form_factor: normalizeFormFactor(ff),
      } as CatalogComponent;
    }

    case "ram": {
      const gen = ramGen(first(attrs, "ram_thehe"));
      if (!gen) return null;
      return {
        ...shared,
        type: "ram",
        ram_gen: gen, // search filter
        generation: gen, // E002 check
        tdp: 3, // modules draw a few watts; feeds PSU sizing
      } as CatalogComponent;
    }

    case "psu": {
      const wattage = parseWatts(first(attrs, "nguon_congsuattoida"));
      if (!wattage) return null;
      const ffRaw = (first(attrs, "nguon_chuankichthuoc") ?? "ATX").toUpperCase();
      const form_factor = ffRaw.includes("SFX") ? "SFX" : "ATX";
      return {
        ...shared,
        type: "psu",
        wattage,
        form_factor,
      } as CatalogComponent;
    }

    case "cooler": {
      // Socket + height come straight from structured attributes now.
      const sockets = (attrs["tannhiet_sockethotro"] ?? [])
        .map(normalizeSocket)
        .filter((s) => s.length > 0);
      const isLiquid = /nước|aio|liquid|water/i.test(
        first(attrs, "tannhiet_dangtannhiet") ?? "",
      );
      const height =
        cmToMm(first(attrs, "height")) ??
        parseMm(first(attrs, "tannhiet_chieucaotankhi")) ??
        (isLiquid ? 60 : 158);
      // No tdp: a cooler's fan draw is negligible, and the Compiler would
      // otherwise sum it into required PSU wattage (the old 200W default
      // inflated every build's PSU requirement). Coolers are validated by
      // height vs case clearance only.
      const result = {
        ...shared,
        type: "cooler",
        height,
      } as CatalogComponent;
      if (sockets.length > 0) result.socket = sockets;
      return result;
    }

    case "case": {
      const mbRaw = attrs["case_kichthuocmainboard"] ?? [];
      const supported = mbRaw
        .map((f) => normalizeFormFactor(f))
        .filter((f) => f !== "E-ATX");
      const supported_mb_form_factors =
        supported.length > 0 ? [...new Set(supported)] : supportedMbFormFactors("ATX");
      return {
        ...shared,
        type: "case",
        form_factor: normalizeFormFactor(mbRaw[0] ?? "ATX"),
        supported_mb_form_factors,
        supported_psu_form_factors: ["ATX"],
        max_cooler_height:
          parseMm(first(attrs, "case_docaotoidacuatannhietcpu")) ?? 160,
        clearance_mm: parseMm(first(attrs, "case_dodaivgatoida")) ?? 330,
      } as CatalogComponent;
    }

    case "storage": {
      const kind = (first(attrs, "ocung_phanloai") ?? "").toLowerCase();
      // HDDs spin platters (~6W); SSDs are lower (~5W). Small but real for PSU sizing.
      const tdp = kind.includes("hdd") ? 6 : 5;
      return { ...shared, type: "storage", tdp } as CatalogComponent;
    }

    case "gpu": {
      return {
        ...shared,
        type: "gpu",
        // Estimate board power from aux connectors; feeds PSU sizing (W001).
        tdp: gpuTdpFromConnectors(first(attrs, "vga_daucapnguonphu")) ?? 300,
        clearance_mm: cmToMm(first(attrs, "length")) ?? 300,
      } as CatalogComponent;
    }

    default:
      return null;
  }
}
