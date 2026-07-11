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
