import type { ERROR_CODES } from "./codes.js";

export type ErrorCode = keyof typeof ERROR_CODES;
export type Severity = "error" | "warning";

export interface Cpu {
  type: "cpu";
  id: string;
  socket?: string;
  ram_gen_supported?: string[];
  tdp?: number;
}

export interface Mainboard {
  type: "mainboard";
  id: string;
  socket?: string;
  ram_gen_supported?: string[];
  form_factor?: string;
}

export interface Ram {
  type: "ram";
  id: string;
  generation?: string;
  tdp?: number;
}

export interface Psu {
  type: "psu";
  id: string;
  wattage?: number;
  form_factor?: string;
}

export interface Cooler {
  type: "cooler";
  id: string;
  height?: number;
}

export interface Case {
  type: "case";
  id: string;
  max_cooler_height?: number;
  supported_mb_form_factors?: string[];
  supported_psu_form_factors?: string[];
}

export interface Storage {
  type: "storage";
  id: string;
  tdp?: number;
}

export interface Gpu {
  type: "gpu";
  id: string;
  tdp?: number;
}

export interface OtherComponent {
  type: string;
  id: string;
  tdp?: number;
}

export type Component =
  | Cpu
  | Mainboard
  | Ram
  | Psu
  | Cooler
  | Case
  | Storage
  | Gpu
  | OtherComponent;

export interface Build {
  components: Component[];
}

export interface CompilerError {
  code: ErrorCode;
  severity: Severity;
  name: string;
  message: string;
  component_refs: string[];
  details?: Record<string, unknown>;
}

export interface Change {
  component_ref: string;
  attribute: string;
  target_value: string | number | string[];
}

export interface Fix {
  changes: Change[];
  strategy: "replace_component" | "modify_attribute";
  note?: string;
}

export interface RepairPlan {
  error_code: ErrorCode;
  fixes: Fix[];
  rationale: string;
}

export interface CompilerResult {
  errors: CompilerError[];
  repair_plan: RepairPlan[];
  is_valid: boolean;
}
