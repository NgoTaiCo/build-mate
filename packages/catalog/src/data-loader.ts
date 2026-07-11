import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { CatalogComponent, ComponentType, ALL_TYPES } from "./types.js";
import { MOCK_CATALOG } from "./mock-data.js";
import { getCatalogDataMode } from "./config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** A loaded catalog slice plus the concrete source it actually came from. */
export interface LoadedCatalog {
  components: CatalogComponent[];
  source: "phongvu" | "mock";
}

const CATALOG_CACHE: Map<ComponentType, LoadedCatalog> = new Map();

function getDataPath(type: ComponentType): string {
  return resolve(__dirname, `../data/phongvu-catalog-${type}.json`);
}

function mockSlice(type: ComponentType): LoadedCatalog {
  return { components: MOCK_CATALOG.filter((c) => c.type === type), source: "mock" };
}

function loadCatalogFile(type: ComponentType): LoadedCatalog {
  if (CATALOG_CACHE.has(type)) {
    return CATALOG_CACHE.get(type)!;
  }

  let loaded: LoadedCatalog;

  // Forced mock mode: never touch the filesystem.
  if (getCatalogDataMode() === "mock") {
    loaded = mockSlice(type);
    CATALOG_CACHE.set(type, loaded);
    return loaded;
  }

  try {
    const path = getDataPath(type);
    if (!existsSync(path)) {
      // Fall back to mock data if the PhongVu JSON file doesn't exist.
      loaded = mockSlice(type);
    } else {
      const content = readFileSync(path, "utf-8");
      const components = JSON.parse(content) as CatalogComponent[];
      loaded = { components, source: "phongvu" };
    }
  } catch (error) {
    console.warn(`Failed to load catalog data for ${type}, using mock:`, error);
    loaded = mockSlice(type);
  }

  CATALOG_CACHE.set(type, loaded);
  return loaded;
}

export function loadAllCatalogs(): CatalogComponent[] {
  const all: CatalogComponent[] = [];
  for (const type of ALL_TYPES) {
    all.push(...loadCatalogFile(type).components);
  }
  return all;
}

export function loadCatalogByType(type: ComponentType): CatalogComponent[] {
  return loadCatalogFile(type).components;
}

/** Same as loadCatalogByType, but also reports whether it served PhongVu or mock. */
export function loadCatalogByTypeWithSource(type: ComponentType): LoadedCatalog {
  return loadCatalogFile(type);
}

export function getCatalogPath(type: ComponentType): string {
  return getDataPath(type);
}

/** Clears the in-memory catalog cache. Intended for tests that toggle the data mode. */
export function clearCatalogCache(): void {
  CATALOG_CACHE.clear();
}
