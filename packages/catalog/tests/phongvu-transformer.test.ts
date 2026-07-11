import { test } from "node:test";
import { strictEqual, ok } from "node:assert/strict";
import {
  transformPhongVuProduct,
  transformPhongVuProducts,
} from "../src/phongvu-transformer.js";

test("PhongVu transformer - CPU extraction", () => {
  const cpuProduct = {
    sku: "211208131",
    name: "CPU Intel Core i5-12400",
    latestPrice: "5590000",
    totalAvailable: 2,
    discountPercent: 20,
    shortDescription:
      "<p>- Socket: 1700<br>- TDP: 65W<br>- 6 cores / 12 threads</p>",
    highlight: "<div>Socket 1700</div><div>6 nhân / 12 luồng</div>",
  };

  const result = transformPhongVuProduct(cpuProduct, "cpu");
  ok(result !== null);
  strictEqual(result.type, "cpu");
  strictEqual(result.socket, "1700");
  strictEqual(result.tdp, 65);
  strictEqual(result.price, 5590000);
  strictEqual(result.stock_status, "in_stock");
  strictEqual(result.promo, "20% discount");
  strictEqual(result.sku, "211208131");
});

test("PhongVu transformer - Mainboard extraction", () => {
  const mainboardProduct = {
    sku: "311450256",
    name: "ASUS ROG STRIX X870-E",
    latestPrice: "8500000",
    totalAvailable: 1,
    discountPercent: 0,
    shortDescription:
      "<p>Socket AM5, DDR5, ATX, PCIe 5.0, X870 chipset</p>",
    highlight:
      "<div>Socket AM5</div><div>DDR5</div><div>ATX</div><div>X870</div>",
  };

  const result = transformPhongVuProduct(mainboardProduct, "mainboard");
  ok(result !== null);
  strictEqual(result.type, "mainboard");
  strictEqual(result.socket, "AM5");
  strictEqual(result.ram_gen, "DDR5");
  strictEqual(result.form_factor, "ATX");
  strictEqual(result.price, 8500000);
  strictEqual(result.stock_status, "in_stock");
  strictEqual(result.promo, null);
});

test("PhongVu transformer - RAM extraction", () => {
  const ramProduct = {
    sku: "411890210",
    name: "Corsair Vengeance RGB Pro DDR5 32GB 6000MHz",
    latestPrice: "3200000",
    totalAvailable: 5,
    discountPercent: 0,
    shortDescription: "<p>DDR5 32GB 6000MHz CAS 30</p>",
  };

  const result = transformPhongVuProduct(ramProduct, "ram");
  ok(result !== null);
  strictEqual(result.type, "ram");
  strictEqual(result.ram_gen, "DDR5");
  strictEqual(result.price, 3200000);
  strictEqual(result.stock_status, "in_stock");
});

test("PhongVu transformer - PSU extraction", () => {
  const psuProduct = {
    sku: "512340560",
    name: "Corsair RM1000e 1000W 80+ Gold",
    latestPrice: "5200000",
    totalAvailable: 3,
    discountPercent: 10,
    shortDescription: "<p>1000W 80+ Gold, Modular, ATX</p>",
    highlight: "<div>1000W</div><div>80+ Gold</div><div>ATX</div>",
  };

  const result = transformPhongVuProduct(psuProduct, "psu");
  ok(result !== null);
  strictEqual(result.type, "psu");
  strictEqual(result.wattage, 1000);
  strictEqual(result.form_factor, "ATX");
  strictEqual(result.price, 5200000);
  strictEqual(result.promo, "10% discount");
});

test("PhongVu transformer - Cooler extraction", () => {
  const coolerProduct = {
    sku: "601280150",
    name: "Noctua NH-D15",
    latestPrice: "2500000",
    totalAvailable: 2,
    discountPercent: 0,
    shortDescription:
      "<p>Socket: AM5, AM4, LGA1700 / TDP: 220W / Air Tower</p>",
    highlight:
      "<div>Socket AM5, AM4, LGA1700</div><div>TDP: 220W</div><div>Air Tower</div>",
  };

  const result = transformPhongVuProduct(coolerProduct, "cooler");
  ok(result !== null);
  strictEqual(result.type, "cooler");
  ok(Array.isArray(result.socket));
  strictEqual(result.socket.length, 3);
  ok(result.socket.includes("AM5"));
  ok(result.socket.includes("AM4"));
  ok(result.socket.includes("LGA1700"));
  // Coolers no longer carry a tdp: fan draw is negligible and must not inflate
  // PSU sizing. Validated by height vs case clearance only.
  strictEqual(result.tdp, undefined);
  strictEqual(result.price, 2500000);
});

test("PhongVu transformer - Case extraction", () => {
  const caseProduct = {
    sku: "701950180",
    name: "Lian Li Lancool 215",
    latestPrice: "1200000",
    totalAvailable: 0,
    discountPercent: 0,
    shortDescription:
      "<p>mATX Case, GPU Clearance 310mm, Front Mesh</p>",
    highlight: "<div>mATX</div><div>GPU Clearance: 310mm</div>",
  };

  const result = transformPhongVuProduct(caseProduct, "case");
  ok(result !== null);
  strictEqual(result.type, "case");
  strictEqual(result.form_factor, "mATX");
  strictEqual(result.clearance_mm, 310);
  strictEqual(result.stock_status, "out_of_stock");
});

test("PhongVu transformer - GPU extraction", () => {
  const gpuProduct = {
    sku: "801450780",
    name: "NVIDIA RTX 4090",
    latestPrice: "45000000",
    totalAvailable: null,
    discountPercent: 0,
    shortDescription:
      "<p>TDP: 575W, Length: 420mm, GDDR6X 24GB</p>",
    highlight: "<div>RTX 4090</div><div>TDP 575W</div><div>420mm</div>",
  };

  const result = transformPhongVuProduct(gpuProduct, "gpu");
  ok(result !== null);
  strictEqual(result.type, "gpu");
  strictEqual(result.tdp, 575);
  strictEqual(result.clearance_mm, 420);
  strictEqual(result.stock_status, "out_of_stock");
});

test("PhongVu transformer - Storage extraction", () => {
  const storageProduct = {
    sku: "901230450",
    name: "Samsung 990 Pro 2TB NVMe SSD",
    latestPrice: "4500000",
    totalAvailable: 8,
    discountPercent: 5,
    shortDescription: "<p>NVMe SSD 2TB PCIe 4.0</p>",
  };

  const result = transformPhongVuProduct(storageProduct, "storage");
  ok(result !== null);
  strictEqual(result.type, "storage");
  strictEqual(result.price, 4500000);
  strictEqual(result.stock_status, "in_stock");
  strictEqual(result.promo, "5% discount");
});

test("PhongVu transformer - Missing required field returns null", () => {
  const invalidCpuProduct = {
    sku: "999999999",
    name: "Invalid CPU",
    latestPrice: "5000000",
    totalAvailable: 1,
    discountPercent: 0,
    shortDescription: "<p>No socket information</p>",
    highlight: "<div>Some random info</div>",
  };

  const result = transformPhongVuProduct(invalidCpuProduct, "cpu");
  strictEqual(result, null);
});

test("PhongVu transformer - Invalid price returns null", () => {
  const invalidPriceProduct = {
    sku: "999999998",
    name: "Invalid Price CPU",
    latestPrice: "not_a_number",
    totalAvailable: 1,
    discountPercent: 0,
    shortDescription: "<p>Socket 1700, TDP 65W</p>",
  };

  const result = transformPhongVuProduct(invalidPriceProduct, "cpu");
  strictEqual(result, null);
});

test("PhongVu transformer - Transform multiple products", () => {
  const products = [
    {
      sku: "211208131",
      name: "CPU Intel Core i5-12400",
      latestPrice: "5590000",
      totalAvailable: 2,
      discountPercent: 0,
      shortDescription:
        "<p>- Socket: 1700<br>- TDP: 65W<br>- 6 cores / 12 threads</p>",
      highlight: "<div>Socket 1700</div><div>6 nhân / 12 luồng</div>",
    },
    {
      sku: "211208132",
      name: "CPU Intel Core i7-13700K",
      latestPrice: "8900000",
      totalAvailable: 1,
      discountPercent: 0,
      shortDescription:
        "<p>- Socket: 1700<br>- TDP: 253W<br>- 16 cores / 24 threads</p>",
      highlight: "<div>Socket 1700</div><div>16 cores / 24 threads</div>",
    },
    {
      sku: "invalid",
      name: "Invalid CPU",
      latestPrice: "5000000",
      totalAvailable: 1,
      discountPercent: 0,
      shortDescription: "<p>No socket</p>",
    },
  ];

  const results = transformPhongVuProducts(products, "cpu");
  strictEqual(results.length, 2);
  strictEqual(results[0].sku, "211208131");
  strictEqual(results[1].sku, "211208132");
});

test("PhongVu transformer - DDR4 RAM extraction", () => {
  const ddr4Product = {
    sku: "411890211",
    name: "G.Skill Ripjaws V DDR4 32GB 3600MHz",
    latestPrice: "2800000",
    totalAvailable: 6,
    discountPercent: 0,
    shortDescription: "<p>DDR4 32GB 3600MHz CAS 18</p>",
  };

  const result = transformPhongVuProduct(ddr4Product, "ram");
  ok(result !== null);
  strictEqual(result.type, "ram");
  strictEqual(result.ram_gen, "DDR4");
});

test("PhongVu transformer - ITX mainboard extraction", () => {
  const itxMainboardProduct = {
    sku: "311450257",
    name: "ASRock B850M-ITX/TB4",
    latestPrice: "6500000",
    totalAvailable: 2,
    discountPercent: 0,
    shortDescription:
      "<p>Socket AM5, DDR5, ITX, PCIe 5.0</p>",
    highlight: "<div>Socket AM5</div><div>DDR5</div><div>ITX</div>",
  };

  const result = transformPhongVuProduct(itxMainboardProduct, "mainboard");
  ok(result !== null);
  strictEqual(result.form_factor, "ITX");
});
