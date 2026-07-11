import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerCompileBuildTool } from "./tools/compile-build.js";
import { registerDetectErrorsTool } from "./tools/detect-errors.js";
import { registerRepairBuildTool } from "./tools/repair-build.js";
import { registerSearchComponentsTool } from "./tools/search-components.js";
import { createHttpDomBridgeClient, type DomBridgeClient } from "./dom/bridge-client.js";
import { registerAddToBuildTool } from "./tools/add-to-build.js";
import { registerReadCurrentBuildTool } from "./tools/read-current-build.js";
import { registerRevertComponentTool } from "./tools/revert-component.js";

export function createServer(options: { domBridgeClient?: DomBridgeClient } = {}): McpServer {
  const server = new McpServer({
    name: "buildmate-compiler",
    version: "0.1.0",
  });

  registerCompileBuildTool(server);
  registerDetectErrorsTool(server);
  registerRepairBuildTool(server);
  registerSearchComponentsTool(server);
  const domBridgeClient = options.domBridgeClient ?? createHttpDomBridgeClient();
  registerReadCurrentBuildTool(server, domBridgeClient);
  registerAddToBuildTool(server, domBridgeClient);
  registerRevertComponentTool(server, domBridgeClient);

  return server;
}
