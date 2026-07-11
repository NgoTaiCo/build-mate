import {
  CatalogComponent,
  SearchCriteria,
  CatalogResult,
  DataSourceError,
  ALL_TYPES,
} from "./types.js";
import { MOCK_CATALOG } from "./mock-data.js";
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

  // Filter and sort
  const filtered = MOCK_CATALOG.filter(composedPredicate);
  return filtered.sort(sortByPriceAscending);
}

export async function searchComponents(
  criteria: SearchCriteria
): Promise<CatalogResult> {
  const targetTypes = criteria.type ? [criteria.type] : ALL_TYPES;
  const results: CatalogComponent[] = [];
  const errors: DataSourceError[] = [];
  let hasMock = false;
  let hasLive = false;

  const client = createApifyClient();

  // Fetch per-category with per-type fallback
  for (const type of targetTypes) {
    try {
      const liveResults = await client.fetchType(type);

      if (liveResults && liveResults.length > 0) {
        results.push(...liveResults);
        hasLive = true;
      } else {
        // Fall back to mock for this type
        const mockResults = MOCK_CATALOG.filter((c) => c.type === type);
        results.push(...mockResults);
        hasMock = true;

        if (!liveResults) {
          errors.push({
            type,
            source: "apify",
            message: "Apify returned empty or null",
          });
        }
      }
    } catch (error) {
      // Fall back to mock on error
      const mockResults = MOCK_CATALOG.filter((c) => c.type === type);
      results.push(...mockResults);
      hasMock = true;

      errors.push({
        type,
        source: "apify",
        message:
          error instanceof Error
            ? error.message
            : "Unknown error",
      });
    }
  }

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
        source: hasLive ? "live" : hasMock ? "mock" : "mixed",
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

  const source = hasLive && !hasMock ? "live" : !hasLive && hasMock ? "mock" : "mixed";

  return {
    components: sorted,
    source,
    errors,
  };
}
