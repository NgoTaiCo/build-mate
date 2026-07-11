import type { Build, CompilerError } from "./types.js";
import { checkMissing } from "./rules/missing.js";
import { checkSocket } from "./rules/socket.js";
import { checkRamGen } from "./rules/ram-gen.js";
import { checkCooler } from "./rules/cooler.js";
import { checkFormFactor } from "./rules/form-factor.js";
import { checkPsu } from "./rules/psu.js";

export function validate(build: Build): CompilerError[] {
  return [
    ...checkMissing(build),
    ...checkSocket(build),
    ...checkRamGen(build),
    ...checkCooler(build),
    ...checkFormFactor(build),
    ...checkPsu(build),
  ];
}
