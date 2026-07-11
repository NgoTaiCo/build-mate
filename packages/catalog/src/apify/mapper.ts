import { CatalogComponent, ComponentType } from "../types.js";
import { getSupportedFormFactors } from "../form-factor.js";

interface ApifyScrapedProduct {
  name: string;
  price: number | null;
  stock_status: string | null;
  promo: string | null;
  specs: string;
  category: string | null;
}


function parseSocket(specs: string): string | null {
  const match = specs.match(/Socket:\s*(AM\d|LGA\d+|sTRX4|TR4)/i);
  return match ? match[1].toUpperCase() : null;
}

function parseTdp(specs: string): number | null {
  const match = specs.match(/TDP:\s*(\d+)\s*W/i);
  return match ? parseInt(match[1], 10) : null;
}

function parseRamGen(specs: string): string | null {
  const match = specs.match(/DDR(\d+)/i);
  return match ? `DDR${match[1]}` : null;
}

function parseFormFactor(specs: string): string | null {
  const match = specs.match(/(ATX|mATX|Mini-ITX|ITX|SFX)/i);
  if (!match) return null;

  const factor = match[1].toUpperCase();
  if (factor === "MINI-ITX") return "ITX";
  return factor;
}

function parseClearance(specs: string): number | null {
  const match = specs.match(/GPU\s*.*?(\d+)\s*mm/i);
  return match ? parseInt(match[1], 10) : null;
}

function parseWattage(specs: string): number | null {
  const match = specs.match(/(\d+)\s*W(?:atts?)?/i);
  return match ? parseInt(match[1], 10) : null;
}

function mapStockStatus(status: string | null): "in_stock" | "out_of_stock" {
  if (!status) return "out_of_stock";

  const normalized = status.toLowerCase();
  if (normalized.includes("hết") || normalized.includes("out") || normalized.includes("unavailable")) {
    return "out_of_stock";
  }
  if (normalized.includes("còn") || normalized.includes("in stock") || normalized.includes("available")) {
    return "in_stock";
  }

  return "out_of_stock";
}

export function mapScrapedProduct(
  product: ApifyScrapedProduct,
  inferredType: ComponentType
): CatalogComponent | null {
  if (!product.name || product.price === null) {
    return null;
  }

  const type = inferredType;

  const base: CatalogComponent = {
    sku: `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name: product.name,
    type,
    price: product.price,
    stock_status: mapStockStatus(product.stock_status),
    promo: product.promo || null,
  };

  const specs = product.specs || "";

  switch (type) {
    case "cpu": {
      const socket = parseSocket(specs);
      const tdp = parseTdp(specs);
      const ramGen = parseRamGen(specs);

      if (!socket || tdp === null || !ramGen) return null;

      return {
        ...base,
        socket,
        tdp,
        ram_gen_supported: [ramGen],
      };
    }

    case "mainboard": {
      const socket = parseSocket(specs);
      const ramGen = parseRamGen(specs);
      const formFactor = parseFormFactor(specs);

      if (!socket || !ramGen || !formFactor) return null;

      return {
        ...base,
        socket,
        ram_gen_supported: [ramGen],
        form_factor: formFactor,
      };
    }

    case "ram": {
      const generation = parseRamGen(specs);
      const tdp = parseTdp(specs);

      if (!generation) return null;

      return {
        ...base,
        generation,
        tdp: tdp || undefined,
      };
    }

    case "psu": {
      const wattage = parseWattage(specs);
      const formFactor = parseFormFactor(specs);

      if (wattage === null || !formFactor) return null;

      return {
        ...base,
        wattage,
        form_factor: formFactor,
      };
    }

    case "cooler": {
      const socket = parseSocket(specs);
      const tdp = parseTdp(specs);
      const height = parseClearance(specs);

      if (!socket || tdp === null) return null;

      return {
        ...base,
        socket: socket.split(",").map((s) => s.trim()),
        tdp,
        height: height || undefined,
      };
    }

    case "case": {
      const formFactor = parseFormFactor(specs);
      const clearance = parseClearance(specs);
      const maxCoolerHeight = parseTdp(specs); // Reuse TDP parser for height

      if (!formFactor) return null;

      const supportedMB = getSupportedFormFactors(formFactor);
      const supportedPSU =
        formFactor === "ITX"
          ? ["SFX"]
          : ["ATX", "SFX"];

      return {
        ...base,
        form_factor: formFactor,
        max_cooler_height: maxCoolerHeight || 165,
        supported_mb_form_factors: supportedMB,
        supported_psu_form_factors: supportedPSU,
        clearance_mm: clearance || undefined,
      };
    }

    case "storage": {
      return base;
    }

    case "gpu": {
      const tdp = parseTdp(specs);
      const clearance = parseClearance(specs);

      if (tdp === null) return null;

      return {
        ...base,
        tdp,
        clearance_mm: clearance || undefined,
      };
    }
  }

  return null;
}
