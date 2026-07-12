import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { z } from "zod";
import { type DomBridgeClient } from "../dom/bridge-client.js";
import { AddToBuildInputSchema } from "../schemas.js";

export async function addToBuildHandler(
  args: z.infer<typeof AddToBuildInputSchema>,
  domBridgeClient: DomBridgeClient,
): Promise<CallToolResult> {
  try {
    const input = AddToBuildInputSchema.parse(args);
    const result = await domBridgeClient.execute({
      action: "add_component",
      context_id: input.context_id,
      component: input.component,
    });
    return { content: [{ type: "text", text: JSON.stringify(result) }], isError: false };
  } catch (error) {
    return {
      content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }],
      isError: true,
    };
  }
}

export function registerAddToBuildTool(server: McpServer, domBridgeClient: DomBridgeClient): void {
  server.registerTool(
    "add_to_build",
    {
      description:
        "Ask the BuildPC extension in context_id to add one exact Catalog component. component.quantity is the desired final count of that exact SKU in its BuildPC slot (default 1). Use only after the proposed build has passed compile_build; this tool never accepts selectors or JavaScript.",
      inputSchema: {
        context_id: AddToBuildInputSchema.shape.context_id,
        component: AddToBuildInputSchema.shape.component,
      },
    },
    (args) => addToBuildHandler(args, domBridgeClient),
  );
}
