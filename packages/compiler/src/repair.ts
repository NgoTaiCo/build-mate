import type {
  Build,
  Case,
  Component,
  CompilerError,
  Cooler,
  Cpu,
  Fix,
  Mainboard,
  RepairPlan,
} from "./types.js";
import { PSU_HEADROOM_RATIO } from "./codes.js";

const ATTRIBUTE_PLACEHOLDERS: Record<string, string | number | string[]> = {
  socket: "AM5",
  ram_gen_supported: ["DDR5"],
  generation: "DDR5",
  tdp: 1,
  wattage: 1,
  form_factor: "ATX",
  height: 1,
  max_cooler_height: 999,
  supported_mb_form_factors: ["ATX"],
  supported_psu_form_factors: ["ATX"],
};

function findComponent(build: Build, id: string): Component | undefined {
  return build.components.find((c) => c.id === id);
}

function repairSocket(build: Build, error: CompilerError): RepairPlan {
  const [cpuId, mbId] = error.component_refs;
  const cpu = findComponent(build, cpuId) as Cpu | undefined;
  const mainboard = findComponent(build, mbId) as Mainboard | undefined;
  const fixes: Fix[] = [];
  if (cpu?.socket && mainboard?.socket) {
    fixes.push({
      changes: [{ component_ref: cpu.id, attribute: "socket", target_value: mainboard.socket }],
      strategy: "replace_component",
    });
    fixes.push({
      changes: [{ component_ref: mainboard.id, attribute: "socket", target_value: cpu.socket }],
      strategy: "replace_component",
    });
  }
  return { error_code: "E001", fixes, rationale: "Đồng bộ socket CPU↔mainboard" };
}

function repairRamGen(build: Build, error: CompilerError): RepairPlan {
  const [ramId, cpuId, mbId] = error.component_refs;
  const cpu = findComponent(build, cpuId) as Cpu | undefined;
  const mainboard = findComponent(build, mbId) as Mainboard | undefined;
  const fixes: Fix[] = [];
  const cpuSupported = cpu?.ram_gen_supported ?? [];
  const mbSupported = mainboard?.ram_gen_supported ?? [];
  const intersection = cpuSupported.filter((g) => mbSupported.includes(g));
  const target = intersection[0] ?? mbSupported[0] ?? cpuSupported[0];
  if (target) {
    fixes.push({
      changes: [{ component_ref: ramId, attribute: "generation", target_value: target }],
      strategy: "replace_component",
    });
  }
  return { error_code: "E002", fixes, rationale: "Đổi RAM generation khớp CPU/mainboard hỗ trợ" };
}

function repairMissing(error: CompilerError): RepairPlan {
  const missingType =
    (error.details?.missing_type as string | undefined) ?? error.component_refs[0]?.replace("type:", "");
  return {
    error_code: "E003",
    fixes: [
      {
        changes: [{ component_ref: `type:${missingType}`, attribute: "type", target_value: missingType }],
        strategy: "replace_component",
        note: `Thêm ≥1 ${missingType} — component còn thiếu cho build hoàn chỉnh`,
      },
    ],
    rationale: `${missingType} bắt buộc cho build hoàn chỉnh (boot-completeness / required set)`,
  };
}

function repairCooler(build: Build, error: CompilerError): RepairPlan {
  const [coolerId, caseId] = error.component_refs;
  const cooler = findComponent(build, coolerId) as Cooler | undefined;
  const kase = findComponent(build, caseId) as Case | undefined;
  const fixes: Fix[] = [];
  if (typeof cooler?.height === "number" && typeof kase?.max_cooler_height === "number") {
    fixes.push({
      changes: [{ component_ref: cooler.id, attribute: "height", target_value: kase.max_cooler_height }],
      strategy: "replace_component",
    });
    fixes.push({
      changes: [{ component_ref: kase.id, attribute: "max_cooler_height", target_value: cooler.height }],
      strategy: "replace_component",
    });
  }
  return { error_code: "E004", fixes, rationale: "Đảm bảo cooler height không vượt case clearance" };
}

function repairFormFactor(build: Build, error: CompilerError): RepairPlan {
  const component = error.details?.component as "mainboard" | "psu" | undefined;
  const [componentId, caseId] = error.component_refs;
  const kase = findComponent(build, caseId) as Case | undefined;
  const fixes: Fix[] = [];
  if (kase && component) {
    const supportedList =
      component === "mainboard" ? kase.supported_mb_form_factors : kase.supported_psu_form_factors;
    if (supportedList && supportedList.length > 0) {
      fixes.push({
        changes: [{ component_ref: componentId, attribute: "form_factor", target_value: supportedList[0] }],
        strategy: "replace_component",
      });
    }
    const actual = error.details?.actual as string | undefined;
    if (actual) {
      const attribute = component === "mainboard" ? "supported_mb_form_factors" : "supported_psu_form_factors";
      fixes.push({
        changes: [{ component_ref: kase.id, attribute, target_value: [...(supportedList ?? []), actual] }],
        strategy: "replace_component",
      });
    }
  }
  return { error_code: "E005", fixes, rationale: "Đồng bộ form-factor linh kiện với case hỗ trợ" };
}

function repairMissingAttribute(error: CompilerError): RepairPlan {
  const attribute = error.details?.attribute as string;
  const componentRef = error.component_refs[0];
  const targetValue = ATTRIBUTE_PLACEHOLDERS[attribute] ?? "";
  return {
    error_code: "E006",
    fixes: [
      {
        changes: [{ component_ref: componentRef, attribute, target_value: targetValue }],
        strategy: "modify_attribute",
        note: `Bổ sung thuộc tính "${attribute}" còn thiếu`,
      },
    ],
    rationale: `Thuộc tính "${attribute}" bắt buộc cho rule liên quan`,
  };
}

function repairPsu(error: CompilerError): RepairPlan {
  const psuId = error.component_refs[0];
  const tdpTotalExclPsu = error.details?.tdp_total_excl_psu as number | undefined;
  const targetWattage = Math.ceil((tdpTotalExclPsu ?? 0) * PSU_HEADROOM_RATIO);
  return {
    error_code: "W001",
    fixes: [
      {
        changes: [{ component_ref: psuId, attribute: "wattage", target_value: targetWattage }],
        strategy: "replace_component",
        note: `Tăng PSU wattage ≥${targetWattage}W (TDP tổng excl. PSU × 1.2)`,
      },
    ],
    rationale: "Đảm bảo PSU có headroom cho load peak/OC",
  };
}

function repairUnknown(error: CompilerError): RepairPlan {
  return { error_code: error.code, fixes: [], rationale: "Không có repair mapping cho mã lỗi này" };
}

export function repairBuild(build: Build, errors: CompilerError[]): RepairPlan[] {
  return errors.map((error) => {
    switch (error.code) {
      case "E001":
        return repairSocket(build, error);
      case "E002":
        return repairRamGen(build, error);
      case "E003":
        return repairMissing(error);
      case "E004":
        return repairCooler(build, error);
      case "E005":
        return repairFormFactor(build, error);
      case "E006":
        return repairMissingAttribute(error);
      case "W001":
        return repairPsu(error);
      default:
        return repairUnknown(error);
    }
  });
}
