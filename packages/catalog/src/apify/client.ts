import { ApifyClient } from "apify-client";
import { CatalogComponent, ComponentType } from "../types.js";
import { mapScrapedProduct } from "./mapper.js";

const APIFY_ACTOR_ID = process.env.APIFY_ACTOR_ID || "YOUR_ACTOR_ID";
const APIFY_TIMEOUT_MS = 10000;

interface ApifyScrapedProduct {
  name: string;
  price: number | null;
  stock_status: string | null;
  promo: string | null;
  specs: string;
  category: string | null;
}

export class ApifyClientWrapper {
  private client: ApifyClient;
  private apiKey: string | undefined;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.APIFY_API_KEY;
    this.client = new ApifyClient({
      token: this.apiKey,
    });
  }

  async fetchType(type: ComponentType): Promise<CatalogComponent[] | null> {
    if (!this.apiKey) {
      return null;
    }

    try {
      const run = await Promise.race([
        this.client.actor(APIFY_ACTOR_ID).call(
          {
            type,
          }
        ),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error("Apify timeout")),
            APIFY_TIMEOUT_MS
          )
        ),
      ]);

      if (!run) {
        return null;
      }

      // Access output data via the run object
      const outputData = (run as unknown as { output?: unknown });
      if (!outputData.output) {
        return null;
      }

      const data = (outputData.output as unknown as { data?: unknown[] }).data;
      if (!Array.isArray(data)) {
        return null;
      }

      const mapped = data
        .map((item) => mapScrapedProduct(item as ApifyScrapedProduct, type))
        .filter((item): item is CatalogComponent => item !== null);

      return mapped.length > 0 ? mapped : null;
    } catch (error) {
      return null;
    }
  }
}

export function createApifyClient(apiKey?: string): ApifyClientWrapper {
  return new ApifyClientWrapper(apiKey);
}
