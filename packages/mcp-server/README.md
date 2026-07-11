# @buildmate/mcp-server

Standalone MCP (Model Context Protocol) server that exposes the deterministic
[`@buildmate/compiler`](../compiler) trust layer plus the
[`@buildmate/catalog`](../catalog) search as four MCP tools:
`compile_build`, `detect_errors`, `repair_build`, `search_components`. The
server only wraps and dispatches to the Compiler/Catalog — it adds no
compatibility or search logic of its own.

Two transports are provided:

- **stdio** (`dist/index.js`) — client spawns the server as a subprocess.
- **Streamable HTTP** (`dist/http.js`) — server listens on a port; MCP clients
  connect over the network. This is the transport used by the Docker image.

## Install

From the repo root (npm workspaces):

```sh
npm install
```

## Run (dev mode)

```sh
cd packages/mcp-server
npx tsx src/index.ts
```

The process blocks on stdin using the MCP stdio transport — no output until
a client connects is expected behavior.

### HTTP transport (dev)

```sh
cd packages/mcp-server
PORT=8791 npx tsx src/http.ts
# health check:  curl localhost:8791/health   -> {"status":"ok"}
# MCP endpoint:  POST http://localhost:8791/mcp
```

Stateless: a fresh server is created per request (no session store, FR-008).

## Docker

Built as a compose service (`buildmate/mcp-server`) using the Streamable HTTP
transport. From `docker/`:

```sh
docker compose up -d --build mcp-server
curl localhost:${MCP_SERVER_PORT:-8791}/health
```

The image multi-stage builds `@buildmate/compiler` → `@buildmate/catalog` →
`@buildmate/mcp-server` and runs `node dist/http.js`. Set `APIFY_API_KEY` in
`docker/.env` to enable live catalog data; without it, `search_components`
serves cached/mock data (`source: "mock"`).

## Test / typecheck

```sh
cd packages/mcp-server
npm test          # dispatch-level tests + InMemoryTransport protocol round-trip
npm run typecheck # tsc --noEmit strict
```

## Connect an MCP client

**stdio** (client spawns the process):

```json
{
  "mcpServers": {
    "buildmate": {
      "command": "node",
      "args": ["/absolute/path/to/packages/mcp-server/dist/index.js"]
    }
  }
}
```

**HTTP** (server already running, e.g. via Docker) — for MCP clients that
support the Streamable HTTP transport:

```json
{
  "mcpServers": {
    "buildmate": {
      "type": "http",
      "url": "http://localhost:8791/mcp"
    }
  }
}
```

Inside the compose network use the service DNS name instead of `localhost`:
`http://mcp-server:8791/mcp`.

## Tools

| Tool | Input | Output | Equivalent to |
|---|---|---|---|
| `compile_build` | `{ build }` | `CompilerResult` (`errors`, `repair_plan`, `is_valid`) | `compileBuild(build)` |
| `detect_errors` | `{ build }` | `CompilerError[]` | `detectErrors(build)` |
| `repair_build` | `{ build, errors }` | `RepairPlan[]` (1:1 with `errors`) | `repairBuild(build, errors)` |
| `search_components` | `SearchCriteria` (`type`, `socket`, `ram_gen`, `form_factor`, price/tdp/wattage range, `stock_status`) | `CatalogResult` (`components`, `source`, `errors`) | `searchComponents(criteria)` |

Malformed/structurally invalid input returns `{ isError: true, content: [...] }`
instead of crashing the process. See [`../../specs/008-compiler-mcp-server/quickstart.md`](../../specs/008-compiler-mcp-server/quickstart.md)
for the full verification walkthrough.
