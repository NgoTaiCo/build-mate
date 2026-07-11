import { createServer as createHttpServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer } from "./server.js";

const PORT = Number(process.env.PORT ?? 8791);
const MCP_PATH = process.env.MCP_PATH ?? "/mcp";

function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      if (chunks.length === 0) {
        resolve(undefined);
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

async function handleMcp(req: IncomingMessage, res: ServerResponse): Promise<void> {
  // Stateless: a fresh McpServer + transport per request. No session store,
  // no shared state between calls (FR-008); the Compiler/Catalog beneath are pure.
  const server = createServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  res.on("close", () => {
    void transport.close();
    void server.close();
  });

  const body = req.method === "POST" ? await readJsonBody(req) : undefined;
  await server.connect(transport);
  await transport.handleRequest(req, res, body);
}

export function createHttpMcpServer() {
  return createHttpServer((req, res) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

    if (url.pathname === "/health") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ status: "ok" }));
      return;
    }

    if (url.pathname !== MCP_PATH) {
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "not_found", path: url.pathname }));
      return;
    }

    handleMcp(req, res).catch((error) => {
      console.error("mcp http request error:", error);
      if (!res.headersSent) {
        res.writeHead(500, { "content-type": "application/json" });
        res.end(
          JSON.stringify({
            jsonrpc: "2.0",
            error: { code: -32603, message: "Internal server error" },
            id: null,
          }),
        );
      }
    });
  });
}

function main(): void {
  const httpServer = createHttpMcpServer();
  httpServer.listen(PORT, () => {
    console.error(
      `buildmate-mcp-server (Streamable HTTP) listening on :${PORT}${MCP_PATH}`,
    );
  });
}

// Only auto-start when run directly (not when imported by a test).
if (process.argv[1] && process.argv[1].endsWith("http.js")) {
  main();
}
