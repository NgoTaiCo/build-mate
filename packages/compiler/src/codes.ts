export const ERROR_CODES = {
  E001: "SOCKET_MISMATCH",
  E002: "RAM_GEN_MISMATCH",
  E003: "MISSING_COMPONENT",
  E004: "COOLER_CLEARANCE_MISMATCH",
  E005: "FORM_FACTOR_MISMATCH",
  E006: "MISSING_ATTRIBUTE",
  W001: "PSU_TIGHT",
} as const;

export const PSU_HEADROOM_RATIO = 1.2;

export const REQUIRED_COMPONENT_TYPES = [
  "cpu",
  "mainboard",
  "ram",
  "psu",
  "cooler",
  "case",
  "storage",
] as const;
