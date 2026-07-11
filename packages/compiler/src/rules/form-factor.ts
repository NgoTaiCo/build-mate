import type { Build, Case, CompilerError, Mainboard, Psu } from "../types.js";
import { checkAttr } from "./check-attr.js";

export function checkFormFactor(build: Build): CompilerError[] {
  const kase = build.components.find((c) => c.type === "case") as Case | undefined;
  if (!kase) return [];

  const mainboard = build.components.find((c) => c.type === "mainboard") as
    | Mainboard
    | undefined;
  const psu = build.components.find((c) => c.type === "psu") as Psu | undefined;

  const errors: CompilerError[] = [];

  if (mainboard) {
    const missingFf = checkAttr(mainboard, "form_factor");
    const missingSupported = checkAttr(kase, "supported_mb_form_factors");
    if (missingFf) {
      errors.push(missingFf);
    } else if (missingSupported) {
      errors.push(missingSupported);
    } else if (!kase.supported_mb_form_factors!.includes(mainboard.form_factor!)) {
      errors.push({
        code: "E005",
        severity: "error",
        name: "FORM_FACTOR_MISMATCH",
        message: `Mainboard form-factor ${mainboard.form_factor} không được case ${kase.id} hỗ trợ`,
        component_refs: [mainboard.id, kase.id],
        details: {
          component: "mainboard",
          actual: mainboard.form_factor,
          supported: kase.supported_mb_form_factors,
        },
      });
    }
  }

  if (psu) {
    const missingFf = checkAttr(psu, "form_factor");
    const missingSupported = checkAttr(kase, "supported_psu_form_factors");
    if (missingFf) {
      errors.push(missingFf);
    } else if (missingSupported) {
      errors.push(missingSupported);
    } else if (!kase.supported_psu_form_factors!.includes(psu.form_factor!)) {
      errors.push({
        code: "E005",
        severity: "error",
        name: "FORM_FACTOR_MISMATCH",
        message: `PSU form-factor ${psu.form_factor} không được case ${kase.id} hỗ trợ`,
        component_refs: [psu.id, kase.id],
        details: {
          component: "psu",
          actual: psu.form_factor,
          supported: kase.supported_psu_form_factors,
        },
      });
    }
  }

  return errors;
}
