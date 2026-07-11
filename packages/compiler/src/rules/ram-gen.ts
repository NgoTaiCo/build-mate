import type { Build, CompilerError, Cpu, Mainboard, Ram } from "../types.js";
import { checkAttr } from "./check-attr.js";

export function checkRamGen(build: Build): CompilerError[] {
  const cpu = build.components.find((c) => c.type === "cpu") as Cpu | undefined;
  const mainboard = build.components.find((c) => c.type === "mainboard") as
    | Mainboard
    | undefined;
  const rams = build.components.filter((c) => c.type === "ram") as Ram[];
  if (!cpu || !mainboard || rams.length === 0) return [];

  const missingCpuGen = checkAttr(cpu, "ram_gen_supported");
  if (missingCpuGen) return [missingCpuGen];
  const missingMbGen = checkAttr(mainboard, "ram_gen_supported");
  if (missingMbGen) return [missingMbGen];

  const errors: CompilerError[] = [];
  for (const ram of rams) {
    const missingGen = checkAttr(ram, "generation");
    if (missingGen) {
      errors.push(missingGen);
      continue;
    }
    const generation = ram.generation as string;
    const supportedByCpu = cpu.ram_gen_supported!.includes(generation);
    const supportedByMb = mainboard.ram_gen_supported!.includes(generation);
    if (!supportedByCpu || !supportedByMb) {
      errors.push({
        code: "E002",
        severity: "error",
        name: "RAM_GEN_MISMATCH",
        message: `RAM ${ram.id} generation ${generation} không được CPU/mainboard hỗ trợ`,
        component_refs: [ram.id, cpu.id, mainboard.id],
        details: {
          ram_generation: generation,
          cpu_supported: cpu.ram_gen_supported,
          mainboard_supported: mainboard.ram_gen_supported,
        },
      });
    }
  }
  return errors;
}
