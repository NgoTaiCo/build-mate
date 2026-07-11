import type { Component, CompilerError } from "../types.js";

export function checkAttr(component: Component, attribute: string): CompilerError | null {
  const value = (component as unknown as Record<string, unknown>)[attribute];
  if (value === undefined || value === null) {
    return {
      code: "E006",
      severity: "error",
      name: "MISSING_ATTRIBUTE",
      message: `${component.type} ${component.id} thiếu thuộc tính bắt buộc "${attribute}"`,
      component_refs: [component.id],
      details: { component_type: component.type, attribute },
    };
  }
  return null;
}
