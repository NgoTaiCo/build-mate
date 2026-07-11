import { test } from "node:test";
import { strictEqual, ok, deepEqual } from "node:assert/strict";
import { transformPhongVuDetail, toAttrMap } from "../src/phongvu-detail.js";
import type { DetailAttribute } from "../src/phongvu-detail.js";
import type { PhongVuProduct } from "../src/phongvu-transformer.js";

function product(overrides: Partial<PhongVuProduct> = {}): PhongVuProduct {
  return {
    sku: "s1",
    name: "Test",
    latestPrice: "1000000",
    totalAvailable: 3,
    discountPercent: 0,
    shortDescription: "",
    ...overrides,
  };
}

const attr = (code: string, values: string[]): DetailAttribute => ({ code, values });

test("toAttrMap keeps only codes with non-empty values", () => {
  const map = toAttrMap([
    attr("a", ["x"]),
    attr("b", []),
    { code: "c" } as DetailAttribute,
  ]);
  deepEqual(Object.keys(map), ["a"]);
  strictEqual(map.a[0], "x");
});

test("detail cooler: normalizes sockets and derives height from cm", () => {
  const map = toAttrMap([
    attr("tannhiet_sockethotro", ["Intel LGA 1700", "AMD AM5", "AMD AM4"]),
    attr("tannhiet_dangtannhiet", ["Tản khí"]),
    attr("height", ["15.5"]),
  ]);
  const c = transformPhongVuDetail(product(), "cooler", map)!;
  ok(c !== null);
  strictEqual(c.type, "cooler");
  deepEqual(c.socket, ["1700", "AM5", "AM4"]);
  strictEqual(c.height, 155);
});

test("detail cooler: liquid cooler with no height defaults low", () => {
  const map = toAttrMap([attr("tannhiet_dangtannhiet", ["Tản nước AIO"])]);
  const c = transformPhongVuDetail(product(), "cooler", map)!;
  strictEqual(c.height, 60);
});

test("detail case: maps supported mb form factors + real cooler clearance", () => {
  const map = toAttrMap([
    attr("case_kichthuocmainboard", ["Mini-ITX", "ATX", "Micro-ATX"]),
    attr("case_docaotoidacuatannhietcpu", ["165 mm"]),
  ]);
  const k = transformPhongVuDetail(product(), "case", map)!;
  strictEqual(k.type, "case");
  deepEqual([...k.supported_mb_form_factors!].sort(), ["ATX", "ITX", "mATX"]);
  strictEqual(k.max_cooler_height, 165);
  deepEqual(k.supported_psu_form_factors, ["ATX"]);
});

test("detail mainboard: requires socket + ram_gen + form_factor", () => {
  const full = toAttrMap([
    attr("mainboard_socket", ["1700"]),
    attr("mainboard_thehebonhohotro", ["DDR4"]),
    attr("mainboard_chuankichthuoc", ["Micro-ATX"]),
  ]);
  const mb = transformPhongVuDetail(product(), "mainboard", full)!;
  strictEqual(mb.socket, "1700");
  strictEqual(mb.ram_gen, "DDR4");
  strictEqual(mb.form_factor, "mATX");

  const missing = toAttrMap([attr("mainboard_socket", ["1700"])]);
  strictEqual(transformPhongVuDetail(product(), "mainboard", missing), null);
});

test("detail psu: parses wattage and form factor", () => {
  const map = toAttrMap([
    attr("nguon_congsuattoida", ["1600W"]),
    attr("nguon_chuankichthuoc", ["ATX"]),
  ]);
  const psu = transformPhongVuDetail(product(), "psu", map)!;
  strictEqual(psu.wattage, 1600);
  strictEqual(psu.form_factor, "ATX");
});

test("detail gpu: card length (cm) becomes clearance_mm, TDP from connectors", () => {
  const map = toAttrMap([
    attr("length", ["22.8"]),
    attr("vga_daucapnguonphu", ["1 x 8-pin"]),
  ]);
  const gpu = transformPhongVuDetail(product(), "gpu", map)!;
  strictEqual(gpu.clearance_mm, 228);
  strictEqual(gpu.tdp, 225); // 150 (8-pin) + 75 (slot)

  const twoConnectors = transformPhongVuDetail(
    product(),
    "gpu",
    toAttrMap([attr("vga_daucapnguonphu", ["2 x 8-pin"])]),
  )!;
  strictEqual(twoConnectors.tdp, 375); // 2*150 + 75

  const hpwr = transformPhongVuDetail(
    product(),
    "gpu",
    toAttrMap([attr("vga_daucapnguonphu", ["1 x 16-pin (12VHPWR)"])]),
  )!;
  strictEqual(hpwr.tdp, 600);

  const noInfo = transformPhongVuDetail(product(), "gpu", toAttrMap([]))!;
  strictEqual(noInfo.tdp, 300); // fallback
});

test("detail cpu: ram_gen_supported inferred from socket", () => {
  const am5 = transformPhongVuDetail(
    product(),
    "cpu",
    toAttrMap([attr("cpu_socket", ["AM5"])]),
  )!;
  deepEqual(am5.ram_gen_supported, ["DDR5"]);

  const intel = transformPhongVuDetail(
    product(),
    "cpu",
    toAttrMap([attr("cpu_socket", ["1700"])]),
  )!;
  deepEqual(intel.ram_gen_supported, ["DDR4", "DDR5"]);
});

test("detail ram: sets generation (E002) alongside ram_gen (search)", () => {
  const ram = transformPhongVuDetail(
    product(),
    "ram",
    toAttrMap([attr("ram_thehe", ["DDR5"])]),
  )!;
  strictEqual(ram.ram_gen, "DDR5");
  strictEqual(ram.generation, "DDR5");
  strictEqual(ram.tdp, 3);
});

test("detail mainboard: exposes ram_gen_supported for E002", () => {
  const mb = transformPhongVuDetail(
    product(),
    "mainboard",
    toAttrMap([
      attr("mainboard_socket", ["AM5"]),
      attr("mainboard_thehebonhohotro", ["DDR5"]),
      attr("mainboard_chuankichthuoc", ["ATX"]),
    ]),
  )!;
  deepEqual(mb.ram_gen_supported, ["DDR5"]);
});

test("detail cooler: carries no tdp (must not inflate PSU sizing)", () => {
  const c = transformPhongVuDetail(
    product(),
    "cooler",
    toAttrMap([attr("height", ["15.5"])]),
  )!;
  strictEqual(c.tdp, undefined);
});

test("detail storage: HDD vs SSD tdp", () => {
  const hdd = transformPhongVuDetail(
    product(),
    "storage",
    toAttrMap([attr("ocung_phanloai", ["di động HDD"])]),
  )!;
  strictEqual(hdd.tdp, 6);
  const ssd = transformPhongVuDetail(
    product(),
    "storage",
    toAttrMap([attr("ocung_phanloai", ["SSD NVMe"])]),
  )!;
  strictEqual(ssd.tdp, 5);
});

test("detail: invalid price returns null regardless of attributes", () => {
  const map = toAttrMap([attr("cpu_socket", ["AM5"])]);
  strictEqual(transformPhongVuDetail(product({ latestPrice: "0" }), "cpu", map), null);
});
