export type ComponentType =
  | "cpu"
  | "mainboard"
  | "ram"
  | "psu"
  | "cooler"
  | "case"
  | "storage"
  | "gpu";

export type DataSource = "live" | "mock" | "mixed";

export interface DataSourceError {
  type: ComponentType;
  source: "apify";
  message: string;
}

export type StockStatus = "in_stock" | "out_of_stock";

export interface CatalogComponent {
  id: string;
  name: string;
  type: ComponentType;
  price: number;
  stock_status: StockStatus;
  promo: string | null;
  // Type-specific fields
  socket?: string | string[];
  tdp?: number;
  ram_gen_supported?: string[];
  generation?: string;
  wattage?: number;
  form_factor?: string;
  max_cooler_height?: number;
  supported_mb_form_factors?: string[];
  supported_psu_form_factors?: string[];
  clearance_mm?: number;
  height?: number;
}

export interface SearchCriteria {
  type?: ComponentType;
  socket?: string;
  ram_gen?: string;
  form_factor?: string;
  price_min?: number;
  price_max?: number;
  stock_status?: StockStatus;
  clearance_mm?: number;
  tdp_min?: number;
  tdp_max?: number;
  wattage_min?: number;
  wattage_max?: number;
}

export interface CatalogResult {
  components: CatalogComponent[];
  source: DataSource;
  errors: DataSourceError[];
}

export const ALL_TYPES: ComponentType[] = [
  "cpu",
  "mainboard",
  "ram",
  "psu",
  "cooler",
  "case",
  "storage",
  "gpu",
];
