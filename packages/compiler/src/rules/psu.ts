import type { Build, CompilerError, Psu } from "../types.js";
import { PSU_HEADROOM_RATIO } from "../codes.js";
import { checkAttr } from "./check-attr.js";

export function checkPsu(build: Build): CompilerError[] {
  const psu = build.components.find((c) => c.type === "psu") as Psu | undefined;
  if (!psu) return [];

  const missingWattage = checkAttr(psu, "wattage");
  if (missingWattage) return [missingWattage];

  const tdpTotalExclPsu = build.components
    .filter((c) => c.type !== "psu" && "tdp" in c && typeof c.tdp === "number" && c.tdp > 0)
    .reduce((sum, c) => sum + (c as { tdp: number }).tdp, 0);

  const requiredWattage = tdpTotalExclPsu * PSU_HEADROOM_RATIO;

  if (psu.wattage! < requiredWattage) {
    return [
      {
        code: "W001",
        severity: "warning",
        name: "PSU_TIGHT",
        message: `PSU ${psu.wattage}W thấp hơn TDP tổng ${tdpTotalExclPsu}W + headroom 20% (cần ≥${requiredWattage}W)`,
        component_refs: [psu.id],
        details: {
          tdp_total_excl_psu: tdpTotalExclPsu,
          required_wattage: requiredWattage,
          actual_wattage: psu.wattage,
        },
      },
    ];
  }
  return [];
}
