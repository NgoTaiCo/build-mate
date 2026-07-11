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
