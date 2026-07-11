import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { CatalogComponent, ComponentType, ALL_TYPES } from "./types.js";
import { MOCK_CATALOG } from "./mock-data.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CATALOG_CACHE: Map<ComponentType, CatalogComponent[]> = new Map();

function getDataPath(type: ComponentType): string {
  return resolve(__dirname, `../data/phongvu-catalog-${type}.json`);
}

function loadCatalogFile(type: ComponentType): CatalogComponent[] {
  if (CATALOG_CACHE.has(type)) {
    return CATALOG_CACHE.get(type)!;
  }

  try {
    const path = getDataPath(type);
    if (!existsSync(path)) {
      // Fall back to mock data if JSON file doesn't exist
      const mockData = MOCK_CATALOG.filter((c) => c.type === type);
      CATALOG_CACHE.set(type, mockData);
      return mockData;
    }

    const content = readFileSync(path, "utf-8");
    const components = JSON.parse(content) as CatalogComponent[];
    CATALOG_CACHE.set(type, components);
    return components;
  } catch (error) {
    console.warn(`Failed to load catalog data for ${type}, using mock:`, error);
    const mockData = MOCK_CATALOG.filter((c) => c.type === type);
    CATALOG_CACHE.set(type, mockData);
    return mockData;
  }
}

export function loadAllCatalogs(): CatalogComponent[] {
  const all: CatalogComponent[] = [];
  for (const type of ALL_TYPES) {
    all.push(...loadCatalogFile(type));
  }
  return all;
}

export function loadCatalogByType(type: ComponentType): CatalogComponent[] {
  return loadCatalogFile(type);
}

export function getCatalogPath(type: ComponentType): string {
  return getDataPath(type);
}
