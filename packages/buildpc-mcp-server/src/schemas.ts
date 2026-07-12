import { z } from "zod";

const ComponentSchema = z
  .object({
    type: z.string(),
    id: z.string(),
  })
  .catchall(z.unknown());

export const BuildSchema = z.object({
  components: z.array(ComponentSchema),
});

// Raw zod shape for the catalog search tool — each field is an optional
// top-level tool parameter mirroring @buildmate/catalog's SearchCriteria.
export const SearchCriteriaShape = {
  type: z
    .enum(["cpu", "mainboard", "ram", "psu", "cooler", "case", "storage", "gpu"])
    .optional(),
  socket: z.string().optional(),
  ram_gen: z.string().optional(),
  form_factor: z.string().optional(),
  price_min: z.number().optional(),
  price_max: z.number().optional(),
  stock_status: z.enum(["in_stock", "out_of_stock"]).optional(),
  clearance_mm: z.number().optional(),
  tdp_min: z.number().optional(),
  tdp_max: z.number().optional(),
  wattage_min: z.number().optional(),
  wattage_max: z.number().optional(),
};

export const CompilerErrorSchema = z.object({
  code: z.string(),
  severity: z.enum(["error", "warning"]),
  name: z.string(),
  message: z.string(),
  component_refs: z.array(z.string()),
  details: z.record(z.unknown()).optional(),
});

export const DomContextIdSchema = z.string().min(1).max(128);

export const DomComponentSchema = z.object({
  sku: z.string().min(1).max(128),
  vendor_product_id: z.string().min(1).max(128),
  name: z.string().min(1).max(300),
  category: z.enum(["cpu", "mainboard", "ram", "gpu", "storage", "psu", "case", "cooler"]),
  buildpc_slot: z.enum(["hdd", "ssd"]).optional(),
  quantity: z.number().int().min(1).max(16).optional(),
  filter_labels: z.array(z.string().trim().min(1).max(120)).max(6).optional(),
  replace_existing: z.boolean().optional(),
  product_url: z.string().url().optional(),
});

export const ReadCurrentBuildInputSchema = z.object({
  context_id: DomContextIdSchema,
});

export const AddToBuildInputSchema = z.object({
  context_id: DomContextIdSchema,
  component: DomComponentSchema,
});

export const RevertComponentInputSchema = z.object({
  context_id: DomContextIdSchema,
  component: DomComponentSchema,
  expected_revision: z.string().min(2).max(10_000).optional(),
});
