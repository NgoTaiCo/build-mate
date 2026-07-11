import type { Build, CompilerError } from "../types.js";
import { REQUIRED_COMPONENT_TYPES } from "../codes.js";

export function checkMissing(build: Build): CompilerError[] {
  const errors: CompilerError[] = [];
  for (const requiredType of REQUIRED_COMPONENT_TYPES) {
    const has = build.components.some((c) => c.type === requiredType);
    if (!has) {
      errors.push({
        code: "E003",
        severity: "error",
        name: "MISSING_COMPONENT",
        message: `Build thiếu ${requiredType}`,
        component_refs: [`type:${requiredType}`],
        details: { missing_type: requiredType },
      });
    }
  }
  return errors;
}
