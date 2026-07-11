import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { z } from "zod";
import { type DomBridgeClient } from "../dom/bridge-client.js";
import { RevertComponentInputSchema } from "../schemas.js";

export async function revertComponentHandler(
  args: z.infer<typeof RevertComponentInputSchema>,
  domBridgeClient: DomBridgeClient,
): Promise<CallToolResult> {
  try {
    const input = RevertComponentInputSchema.parse(args);
    const result = await domBridgeClient.execute({
      action: "remove_component",
      context_id: input.context_id,
      component: input.component,
      expected_revision: input.expected_revision,
    });
    return { content: [{ type: "text", text: JSON.stringify(result) }], isError: false };
  } catch (error) {
    return {
      content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }],
      isError: true,
    };
  }
}

export function registerRevertComponentTool(server: McpServer, domBridgeClient: DomBridgeClient): void {
  server.registerTool(
    "revert_component",
    {
      description:
        "Revert one component previously added by BuildMate. The extension removes it only when the current BuildPC slot still matches the exact component and optional expected_revision.",
      inputSchema: {
        context_id: RevertComponentInputSchema.shape.context_id,
        component: RevertComponentInputSchema.shape.component,
        expected_revision: RevertComponentInputSchema.shape.expected_revision,
      },
    },
    (args) => revertComponentHandler(args, domBridgeClient),
  );
}
