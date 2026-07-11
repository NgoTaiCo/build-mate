import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { z } from "zod";
import { type DomBridgeClient } from "../dom/bridge-client.js";
import { ReadCurrentBuildInputSchema } from "../schemas.js";

export async function readCurrentBuildHandler(
  args: z.infer<typeof ReadCurrentBuildInputSchema>,
  domBridgeClient: DomBridgeClient,
): Promise<CallToolResult> {
  try {
    const input = ReadCurrentBuildInputSchema.parse(args);
    const result = await domBridgeClient.execute({
      action: "read_build",
      context_id: input.context_id,
    });
    return { content: [{ type: "text", text: JSON.stringify(result) }], isError: false };
  } catch (error) {
    return {
      content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }],
      isError: true,
    };
  }
}

export function registerReadCurrentBuildTool(server: McpServer, domBridgeClient: DomBridgeClient): void {
  server.registerTool(
    "read_current_build",
    {
      description:
        "Read the component snapshot from the BuildPC tab identified by context_id through the DOM relay. This tool never reads a browser directly.",
      inputSchema: { context_id: ReadCurrentBuildInputSchema.shape.context_id },
    },
    (args) => readCurrentBuildHandler(args, domBridgeClient),
  );
}
