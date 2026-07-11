export const FORM_FACTOR_RANK: Record<string, number> = {
  ITX: 1,
  mATX: 2,
  ATX: 3,
};

export const FORM_FACTOR_COMPAT: Record<string, string[]> = {
  ATX: ["ATX", "mATX", "ITX"],
  mATX: ["mATX", "ITX"],
  ITX: ["ITX"],
};

export function getSupportedFormFactors(formFactor: string): string[] {
  return FORM_FACTOR_COMPAT[formFactor] || [];
}

export function getFormFactorRank(formFactor: string): number {
  return FORM_FACTOR_RANK[formFactor] ?? 0;
}
