import type { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { detectErrors } from "@buildmate/compiler";
import { BuildSchema } from "../schemas.js";

export function detectErrorsHandler(args: {
  build: z.infer<typeof BuildSchema>;
}): CallToolResult {
  try {
    const result = detectErrors(args.build);
    return {
      content: [{ type: "text", text: JSON.stringify(result) }],
      isError: false,
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: error instanceof Error ? error.message : String(error),
        },
      ],
      isError: true,
    };
  }
}

export function registerDetectErrorsTool(server: McpServer): void {
  server.registerTool(
    "detect_errors",
    {
      description:
        "Validate a PC build and return the list of compatibility errors and warnings, without a repair plan. Dispatches to @buildmate/compiler's detectErrors().",
      inputSchema: { build: BuildSchema },
    },
    detectErrorsHandler,
  );
}
