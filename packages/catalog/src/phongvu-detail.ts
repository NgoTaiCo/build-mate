import { CatalogComponent, ComponentType } from "./types.js";
import {
  PhongVuProduct,
  extractSharedFields,
  normalizeFormFactor,
  supportedMbFormFactors,
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
      const socket = first(attrs, "cpu_socket");
      if (!socket) return null; // socket is essential for E001
      return {
        ...shared,
        type: "cpu",
        socket: normalizeSocket(socket),
        tdp: parseWatts(first(attrs, "tieu_thu_dien_nang_cpu")) ?? 65,
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
        ram_gen: gen,
        form_factor: normalizeFormFactor(ff),
      } as CatalogComponent;
    }

    case "ram": {
      const gen = ramGen(first(attrs, "ram_thehe"));
      if (!gen) return null;
      return { ...shared, type: "ram", ram_gen: gen } as CatalogComponent;
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
      const result = {
        ...shared,
        type: "cooler",
        tdp: 200,
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
      return { ...shared, type: "storage" } as CatalogComponent;
    }

    case "gpu": {
      return {
        ...shared,
        type: "gpu",
        tdp: 300,
        clearance_mm: cmToMm(first(attrs, "length")) ?? 300,
      } as CatalogComponent;
    }

    default:
      return null;
  }
}
