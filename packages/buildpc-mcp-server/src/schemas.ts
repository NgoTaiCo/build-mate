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
