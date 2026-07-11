import type { Build, Case, CompilerError, Cooler } from "../types.js";
import { checkAttr } from "./check-attr.js";

export function checkCooler(build: Build): CompilerError[] {
  const cooler = build.components.find((c) => c.type === "cooler") as Cooler | undefined;
  const kase = build.components.find((c) => c.type === "case") as Case | undefined;
  if (!cooler || !kase) return [];

  const missingHeight = checkAttr(cooler, "height");
  if (missingHeight) return [missingHeight];
  const missingMax = checkAttr(kase, "max_cooler_height");
  if (missingMax) return [missingMax];

  if (cooler.height! > kase.max_cooler_height!) {
    return [
      {
        code: "E004",
        severity: "error",
        name: "COOLER_CLEARANCE_MISMATCH",
        message: `Cooler height ${cooler.height}mm vượt quá case clearance ${kase.max_cooler_height}mm`,
        component_refs: [cooler.id, kase.id],
        details: {
          cooler_height: cooler.height,
          max_cooler_height: kase.max_cooler_height,
        },
      },
    ];
  }
  return [];
}
