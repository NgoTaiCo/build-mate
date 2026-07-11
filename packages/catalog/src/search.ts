import {
  CatalogComponent,
  SearchCriteria,
  CatalogResult,
  DataSource,
  DataSourceError,
  ALL_TYPES,
} from "./types.js";
import {
  loadAllCatalogs,
  loadCatalogByTypeWithSource,
} from "./data-loader.js";
import { getCatalogDataMode } from "./config.js";
import {
  makeTypePredicate,
  makeSocketPredicate,
  makeRamGenPredicate,
  makeFormFactorPredicate,
  makeStockPredicate,
  makePricePredicate,
  makeClearancePredicate,
  makeTdpPredicate,
  makeWattagePredicate,
  composePredicates,
} from "./filter.js";
import { createApifyClient } from "./apify/client.js";

function sortByPriceAscending(
  a: CatalogComponent,
  b: CatalogComponent
): number {
  return a.price - b.price;
}

export function searchComponentsMock(
  criteria: SearchCriteria
): CatalogComponent[] {
  const predicates: ((component: CatalogComponent) => boolean)[] = [];

  // Type filter
  if (criteria.type) {
    const type = criteria.type;
    if (!ALL_TYPES.includes(type)) {
      return [];
    }
    predicates.push(makeTypePredicate(type));
  }

  // Socket filter
  if (criteria.socket) {
    predicates.push(makeSocketPredicate(criteria.socket));
  }

  // RAM generation filter
  if (criteria.ram_gen) {
    predicates.push(makeRamGenPredicate(criteria.ram_gen));
  }

  // Form factor filter (hierarchical for case, exact for mainboard)
  if (criteria.form_factor) {
    predicates.push(
      makeFormFactorPredicate(
        criteria.form_factor,
        criteria.type === "case"
      )
    );
  }

  // Stock status filter
  if (criteria.stock_status) {
    predicates.push(makeStockPredicate(criteria.stock_status));
  }

  // Price range filter
  if (
    criteria.price_min !== undefined ||
    criteria.price_max !== undefined
  ) {
    if (
      criteria.price_min !== undefined &&
      criteria.price_max !== undefined &&
      criteria.price_min > criteria.price_max
    ) {
      return [];
    }
    predicates.push(makePricePredicate(criteria.price_min, criteria.price_max));
  }

  // Clearance filter
  if (criteria.clearance_mm !== undefined) {
    predicates.push(makeClearancePredicate(criteria.clearance_mm));
  }

  // TDP filter
  if (
    criteria.tdp_min !== undefined ||
    criteria.tdp_max !== undefined
  ) {
    predicates.push(makeTdpPredicate(criteria.tdp_min, criteria.tdp_max));
  }

  // Wattage filter
  if (
    criteria.wattage_min !== undefined ||
    criteria.wattage_max !== undefined
  ) {
    predicates.push(
      makeWattagePredicate(criteria.wattage_min, criteria.wattage_max)
    );
  }

  // Compose all predicates with AND logic
  const composedPredicate = composePredicates(...predicates);

  // Load catalog (PhongVu JSON if available, fallback to mock)
  const catalog = loadAllCatalogs();

  // Filter and sort
  const filtered = catalog.filter(composedPredicate);
  return filtered.sort(sortByPriceAscending);
}

export async function searchComponents(
  criteria: SearchCriteria
): Promise<CatalogResult> {
  const targetTypes = criteria.type ? [criteria.type] : ALL_TYPES;
  const results: CatalogComponent[] = [];
  const errors: DataSourceError[] = [];
  const seenSources = new Set<"live" | "phongvu" | "mock">();
  const mode = getCatalogDataMode();

  const client = mode === "live" ? createApifyClient() : null;

  // Fetch per-category with per-type fallback. Only attempt Apify in "live"
  // mode; "phongvu"/"mock" modes read local data straight from the loader,
  // which reports the concrete source it served.
  for (const type of targetTypes) {
    if (client) {
      try {
        const liveResults = await client.fetchType(type);
        if (liveResults && liveResults.length > 0) {
          results.push(...liveResults);
          seenSources.add("live");
          continue;
        }
        errors.push({
          type,
          source: "apify",
          message: "Apify returned empty or null",
        });
      } catch (error) {
        errors.push({
          type,
          source: "apify",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    // Local fallback (live mode) or the primary path (phongvu/mock mode).
    const cached = loadCatalogByTypeWithSource(type);
    results.push(...cached.components);
    seenSources.add(cached.source);
  }

  const resolvedSource: DataSource =
    seenSources.size === 0
      ? "mock"
      : seenSources.size === 1
        ? ([...seenSources][0] as DataSource)
        : "mixed";

  // Apply filters and sort
  const predicates: ((component: CatalogComponent) => boolean)[] = [];

  if (criteria.socket) {
    predicates.push(makeSocketPredicate(criteria.socket));
  }

  if (criteria.ram_gen) {
    predicates.push(makeRamGenPredicate(criteria.ram_gen));
  }

  if (criteria.form_factor) {
    predicates.push(
      makeFormFactorPredicate(
        criteria.form_factor,
        criteria.type === "case"
      )
    );
  }

  if (criteria.stock_status) {
    predicates.push(makeStockPredicate(criteria.stock_status));
  }

  if (
    criteria.price_min !== undefined ||
    criteria.price_max !== undefined
  ) {
    if (
      criteria.price_min !== undefined &&
      criteria.price_max !== undefined &&
      criteria.price_min > criteria.price_max
    ) {
      return {
        components: [],
        source: resolvedSource,
        errors,
      };
    }
    predicates.push(makePricePredicate(criteria.price_min, criteria.price_max));
  }

  if (criteria.clearance_mm !== undefined) {
    predicates.push(makeClearancePredicate(criteria.clearance_mm));
  }

  if (
    criteria.tdp_min !== undefined ||
    criteria.tdp_max !== undefined
  ) {
    predicates.push(makeTdpPredicate(criteria.tdp_min, criteria.tdp_max));
  }

  if (
    criteria.wattage_min !== undefined ||
    criteria.wattage_max !== undefined
  ) {
    predicates.push(
      makeWattagePredicate(criteria.wattage_min, criteria.wattage_max)
    );
  }

  const composedPredicate = composePredicates(...predicates);
  const filtered = results.filter(composedPredicate);
  const sorted = filtered.sort(sortByPriceAscending);

  return {
    components: sorted,
    source: resolvedSource,
    errors,
  };
}
