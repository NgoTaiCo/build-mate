import type { Build, CompilerError, CompilerResult, RepairPlan } from "./types.js";
import { validate } from "./validate.js";
import { repairBuild as repairBuildInternal } from "./repair.js";

export function detectErrors(build: Build): CompilerError[] {
  return validate(build);
}

export function repairBuild(build: Build, errors: CompilerError[]): RepairPlan[] {
  return repairBuildInternal(build, errors);
}

export function compileBuild(build: Build): CompilerResult {
  const errors = detectErrors(build);
  return {
    errors,
    repair_plan: repairBuild(build, errors),
    is_valid: !errors.some((e) => e.severity === "error"),
  };
}

export type {
  Build,
  Component,
  Cpu,
  Mainboard,
  Ram,
  Psu,
  Cooler,
  Case,
  Storage,
  Gpu,
  CompilerError,
  CompilerResult,
  RepairPlan,
  Fix,
  Change,
  ErrorCode,
  Severity,
} from "./types.js";
