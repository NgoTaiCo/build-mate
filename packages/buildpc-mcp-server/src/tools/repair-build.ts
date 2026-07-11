import type { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { CompilerError } from "@buildmate/compiler";
import { repairBuild } from "@buildmate/compiler";
import { BuildSchema, CompilerErrorSchema } from "../schemas.js";

export function repairBuildHandler(args: {
  build: z.infer<typeof BuildSchema>;
  errors: z.infer<typeof CompilerErrorSchema>[];
}): CallToolResult {
  try {
    const referencedIds = new Set(args.build.components.map((c) => c.id));
    for (const error of args.errors) {
      const unknownRef = error.component_refs.find(
        (ref) => !ref.startsWith("type:") && !referencedIds.has(ref),
      );
      if (unknownRef) {
        return {
          content: [
            {
              type: "text",
              text: `errors list references component "${unknownRef}" which is not present in the given build`,
            },
          ],
          isError: true,
        };
      }
    }

    const result = repairBuild(args.build, args.errors as CompilerError[]);
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

export function registerRepairBuildTool(server: McpServer): void {
  server.registerTool(
    "repair_build",
    {
      description:
        "Given a PC build and a list of its detected compatibility errors, return a concrete, constraint-based repair plan (1:1 with the given errors). Dispatches to @buildmate/compiler's repairBuild().",
      inputSchema: { build: BuildSchema, errors: CompilerErrorSchema.array() },
    },
    repairBuildHandler,
  );
}
