import type { Build, CompilerError, Cpu, Mainboard } from "../types.js";
import { checkAttr } from "./check-attr.js";

export function checkSocket(build: Build): CompilerError[] {
  const cpu = build.components.find((c) => c.type === "cpu") as Cpu | undefined;
  const mainboard = build.components.find((c) => c.type === "mainboard") as
    | Mainboard
    | undefined;
  if (!cpu || !mainboard) return [];

  const missingCpuSocket = checkAttr(cpu, "socket");
  if (missingCpuSocket) return [missingCpuSocket];
  const missingMbSocket = checkAttr(mainboard, "socket");
  if (missingMbSocket) return [missingMbSocket];

  if (cpu.socket !== mainboard.socket) {
    return [
      {
        code: "E001",
        severity: "error",
        name: "SOCKET_MISMATCH",
        message: `CPU socket ${cpu.socket} không khớp mainboard socket ${mainboard.socket}`,
        component_refs: [cpu.id, mainboard.id],
        details: { expected: mainboard.socket, actual: cpu.socket },
      },
    ];
  }
  return [];
}
