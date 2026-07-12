export type DomCategory =
  | "cpu"
  | "mainboard"
  | "ram"
  | "gpu"
  | "storage"
  | "psu"
  | "case"
  | "cooler";

export interface DomComponent {
  sku: string;
  vendor_product_id: string;
  name: string;
  category: DomCategory;
  buildpc_slot?: "hdd" | "ssd";
  /** Desired total count of this exact component in its BuildPC slot. */
  quantity?: number;
  filter_labels?: string[];
  replace_existing?: boolean;
  product_url?: string;
}

export interface BuildSnapshot {
  status: "ready" | "unavailable";
  components: DomComponent[];
  total: number | null;
  revision: string | null;
}

export type DomCommand =
  | { action: "read_build"; context_id: string }
  | { action: "add_component"; context_id: string; component: DomComponent }
  | { action: "remove_component"; context_id: string; component: DomComponent; expected_revision?: string };

export interface DomCommandResult {
  command_id: string;
  ok: boolean;
  error?: string;
  modal_closed?: boolean;
  snapshot?: BuildSnapshot;
  added?: DomComponent;
  removed?: DomComponent;
}

export interface DomBridgeClient {
  execute(command: DomCommand): Promise<DomCommandResult>;
}

export function createHttpDomBridgeClient(
  relayUrl = process.env.BUILDMATE_DOM_RELAY_URL ?? "http://127.0.0.1:8781",
): DomBridgeClient {
  return {
    async execute(command) {
      const response = await fetch(`${relayUrl}/dom-commands`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(command),
      });
      const result = (await response.json()) as DomCommandResult;
      if (!response.ok && !result.error) {
        throw new Error(`DOM relay returned HTTP ${response.status}`);
      }
      return result;
    },
  };
}
