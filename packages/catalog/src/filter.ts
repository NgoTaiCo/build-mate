import { CatalogComponent, ComponentType } from "./types.js";
import { getFormFactorRank } from "./form-factor.js";

export type Predicate = (component: CatalogComponent) => boolean;

export function makeTypePredicate(type: ComponentType): Predicate {
  return (component: CatalogComponent) => component.type === type;
}

export function makeSocketPredicate(socket: string): Predicate {
  return (component: CatalogComponent) => {
    if (component.type === "cooler") {
      if (!Array.isArray(component.socket)) return false;
      return component.socket.includes(socket);
    }

    if (component.type === "cpu" || component.type === "mainboard") {
      return component.socket === socket;
    }

    return false;
  };
}

export function makeRamGenPredicate(ramGen: string): Predicate {
  return (component: CatalogComponent) => {
    if (component.type === "ram") {
      return component.generation === ramGen;
    }

    if (component.type === "mainboard" || component.type === "cpu") {
      if (!Array.isArray(component.ram_gen_supported)) return false;
      return component.ram_gen_supported.includes(ramGen);
    }

    return false;
  };
}

export function makeFormFactorPredicate(
  formFactor: string,
  isCase: boolean = false
): Predicate {
  return (component: CatalogComponent) => {
    if (isCase && component.type === "case") {
      const componentRank = getFormFactorRank(component.form_factor || "");
      const criteriaRank = getFormFactorRank(formFactor);
      // Both must have valid ranks (non-zero)
      if (criteriaRank === 0) return false;
      return componentRank >= criteriaRank;
    }

    if (component.type === "mainboard") {
      return component.form_factor === formFactor;
    }

    return false;
  };
}

export function makeStockPredicate(stockStatus: string): Predicate {
  return (component: CatalogComponent) => component.stock_status === stockStatus;
}

export function makePricePredicate(
  min?: number,
  max?: number
): Predicate {
  return (component: CatalogComponent) => {
    const price = component.price;

    if (min !== undefined && price < min) return false;
    if (max !== undefined && price > max) return false;

    return true;
  };
}

export function makeClearancePredicate(min?: number): Predicate {
  return (component: CatalogComponent) => {
    if (min === undefined) return true;

    const clearance = component.clearance_mm;
    if (clearance === undefined) return false;

    return clearance >= min;
  };
}

export function makeTdpPredicate(min?: number, max?: number): Predicate {
  return (component: CatalogComponent) => {
    if (component.type === "cpu" || component.type === "gpu") {
      const tdp = component.tdp;
      if (tdp === undefined) return false;

      if (min !== undefined && tdp < min) return false;
      if (max !== undefined && tdp > max) return false;

      return true;
    }

    if (component.type === "cooler") {
      const tdp = component.tdp;
      if (tdp === undefined) return false;

      if (min !== undefined && tdp < min) return false;
      if (max !== undefined && tdp > max) return false;

      return true;
    }

    return false;
  };
}

export function makeWattagePredicate(min?: number, max?: number): Predicate {
  return (component: CatalogComponent) => {
    if (component.type !== "psu") return false;

    const wattage = component.wattage;
    if (wattage === undefined) return false;

    if (min !== undefined && wattage < min) return false;
    if (max !== undefined && wattage > max) return false;

    return true;
  };
}

export function composePredicates(...predicates: Predicate[]): Predicate {
  return (component: CatalogComponent) => {
    return predicates.every((predicate) => predicate(component));
  };
}
