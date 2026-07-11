import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerCompileBuildTool } from "./tools/compile-build.js";
import { registerDetectErrorsTool } from "./tools/detect-errors.js";
import { registerRepairBuildTool } from "./tools/repair-build.js";

export function createServer(): McpServer {
  const server = new McpServer({
    name: "buildmate-compiler",
    version: "0.1.0",
  });

  registerCompileBuildTool(server);
  registerDetectErrorsTool(server);
  registerRepairBuildTool(server);

  return server;
}
