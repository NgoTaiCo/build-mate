import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { searchComponents } from "@buildmate/catalog";
import type { SearchCriteria } from "@buildmate/catalog";
import { SearchCriteriaShape } from "../schemas.js";

export async function searchComponentsHandler(
  args: SearchCriteria,
): Promise<CallToolResult> {
  try {
    const result = await searchComponents(args);
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

export function registerSearchComponentsTool(server: McpServer): void {
  server.registerTool(
    "search_components",
    {
      description:
        "Search the PC component catalog by criteria (type, socket, RAM generation, form factor, price/TDP/wattage range, stock status). Dispatches to @buildmate/catalog's searchComponents(): tries live data (Apify) when configured and falls back to cached/mock data otherwise. Returns { components, source: 'live'|'mock'|'mixed', errors }.",
      inputSchema: SearchCriteriaShape,
    },
    searchComponentsHandler,
  );
}
