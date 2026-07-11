/**
 * Catalog data-source mode, configurable via the CATALOG_DATA_SOURCE env var.
 *
 * - "phongvu" (default): serve the cached PhongVu JSON snapshots under data/;
 *   fall back to the bundled MOCK_CATALOG per-type if a file is missing.
 * - "mock": always serve the small bundled MOCK_CATALOG (no file/network I/O).
 * - "live": attempt Apify per type, then fall back to cached PhongVu, then mock.
 */
export type CatalogDataMode = "live" | "phongvu" | "mock";

const DEFAULT_MODE: CatalogDataMode = "phongvu";

export function getCatalogDataMode(): CatalogDataMode {
  const raw = (process.env.CATALOG_DATA_SOURCE ?? "").trim().toLowerCase();
  if (raw === "live" || raw === "phongvu" || raw === "mock") {
    return raw;
  }
  return DEFAULT_MODE;
}
