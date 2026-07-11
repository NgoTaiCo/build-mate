import { compileBuild } from "../src/index.js";

function section(title: string) {
  console.log(`\n=== ${title} ===`);
}

// Scenario 1: full 7-type build with E001 socket mismatch
section("Scenario 1: full 7-type build with E001 socket mismatch");
const result1 = compileBuild({
  components: [
    { type: "cpu", id: "cpu1", socket: "LGA1700", ram_gen_supported: ["DDR4", "DDR5"], tdp: 65 },
    { type: "mainboard", id: "mb1", socket: "AM5", ram_gen_supported: ["DDR5"], form_factor: "ATX" },
    { type: "ram", id: "ram1", generation: "DDR5", tdp: 9 },
    { type: "psu", id: "psu1", wattage: 650, form_factor: "ATX" },
    { type: "cooler", id: "cool1", height: 155 },
    {
      type: "case",
      id: "case1",
      max_cooler_height: 165,
      supported_mb_form_factors: ["ATX", "mATX"],
      supported_psu_form_factors: ["ATX"],
    },
    { type: "storage", id: "ssd1", tdp: 5 },
  ],
});
console.log(JSON.stringify(result1, null, 2));
console.assert(result1.errors[0]?.code === "E001", "Expected errors[0].code === E001");
console.assert(result1.is_valid === false, "Expected is_valid === false");
console.assert(result1.repair_plan[0]?.error_code === "E001", "Expected repair_plan[0].error_code === E001");

// Scenario 2: missing storage triggers E003
section("Scenario 2: missing storage triggers E003");
const result2 = compileBuild({
  components: [
    { type: "cpu", id: "cpu2", socket: "AM5", ram_gen_supported: ["DDR5"], tdp: 65 },
    { type: "mainboard", id: "mb2", socket: "AM5", ram_gen_supported: ["DDR5"], form_factor: "ATX" },
    { type: "ram", id: "ram2", generation: "DDR5", tdp: 9 },
    { type: "psu", id: "psu2", wattage: 650, form_factor: "ATX" },
    { type: "cooler", id: "cool2", height: 155 },
    {
      type: "case",
      id: "case2",
      max_cooler_height: 165,
      supported_mb_form_factors: ["ATX"],
      supported_psu_form_factors: ["ATX"],
    },
    // storage MISSING
  ],
});
console.log(JSON.stringify(result2, null, 2));
const storageError = result2.errors.find((e) => e.code === "E003" && e.component_refs.includes("type:storage"));
console.assert(storageError !== undefined, "Expected E003 with component_refs including type:storage");

// Scenario 3: PSU tdp excluded from TDP sum (malformed catalog)
section("Scenario 3: PSU tdp excluded from TDP sum");
const result3 = compileBuild({
  components: [
    { type: "cpu", id: "c1", socket: "AM5", ram_gen_supported: ["DDR5"], tdp: 100 },
    { type: "mainboard", id: "m1", socket: "AM5", ram_gen_supported: ["DDR5"], form_factor: "ATX" },
    { type: "ram", id: "r1", generation: "DDR5" },
    { type: "cooler", id: "cl1", height: 150 },
    {
      type: "case",
      id: "cs1",
      max_cooler_height: 165,
      supported_mb_form_factors: ["ATX"],
      supported_psu_form_factors: ["ATX"],
    },
    { type: "storage", id: "s1" },
    // malformed: PSU should not declare tdp, but catalog does — must be excluded from sum
    { type: "psu", id: "p1", wattage: 150, form_factor: "ATX", tdp: 50 } as never,
  ],
});
console.log(JSON.stringify(result3, null, 2));
console.assert(
  !result3.errors.some((e) => e.code === "W001"),
  "Expected no W001 — PSU tdp:50 must be excluded from TDP sum (total excl. PSU = 100; required = 120; PSU 150 > 120)",
);

console.log("\nSmoke test complete — all assertions passed (see console.assert above for failures).");
