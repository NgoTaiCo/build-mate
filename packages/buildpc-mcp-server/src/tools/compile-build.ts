import type { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { compileBuild } from "@buildmate/compiler";
import { BuildSchema } from "../schemas.js";

export function compileBuildHandler(args: {
  build: z.infer<typeof BuildSchema>;
}): CallToolResult {
  try {
    const result = compileBuild(args.build);
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

export function registerCompileBuildTool(server: McpServer): void {
  server.registerTool(
    "compile_build",
    {
      description:
        "Validate a PC build and return compatibility status, all detected errors/warnings, and a repair plan in one call. Dispatches to @buildmate/compiler's compileBuild().",
      inputSchema: { build: BuildSchema },
    },
    compileBuildHandler,
  );
}
