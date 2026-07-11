# @buildmate/buildpc-mcp-server

[`@buildmate/compiler`](../compiler) trust layer plus the
[`@buildmate/catalog`](../catalog) search and DOM execution as six MCP tools:
`compile_build`, `detect_errors`, `repair_build`, `search_components`,
`read_current_build`, `add_to_build`. Compiler/Catalog tools only wrap and
dispatch (no compatibility or search logic of their own); DOM tools forward
semantic commands to the DOM bridge.

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
cd packages/buildpc-mcp-server
npx tsx src/index.ts
```

The process blocks on stdin using the MCP stdio transport — no output until
a client connects is expected behavior.

### HTTP transport (dev)

```sh
cd packages/buildpc-mcp-server
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
`@buildmate/buildpc-mcp-server` and runs `node dist/http.js`. The PhongVu catalog
JSON (`packages/catalog/data/`) is shipped in the image.

### Catalog data source (`CATALOG_DATA_SOURCE`)

`search_components` data is selectable via the `CATALOG_DATA_SOURCE` env var,
reflected back in the result's `source` field:

| Value | Behavior | `source` |
|---|---|---|
| `phongvu` (default) | Cached PhongVu JSON snapshots | `"phongvu"` |
| `mock` | Small bundled fixture, no file/network I/O | `"mock"` |
| `live` | Apify per type (needs `APIFY_API_KEY`), falls back to PhongVu then mock | `"live"` / `"mixed"` / `"phongvu"` / `"mock"` |

Override in compose via `docker/.env` (`CATALOG_DATA_SOURCE=live`). `APIFY_API_KEY`
/ `APIFY_ACTOR_ID` are only consulted when `CATALOG_DATA_SOURCE=live`.

## Test / typecheck

```sh
cd packages/buildpc-mcp-server
npm test          # dispatch-level tests + InMemoryTransport protocol round-trip
npm run typecheck # tsc --noEmit strict
```

## Connect an MCP client

**stdio** (client spawns the process):

```json
{
  "mcpServers": {
    "buildmate-buildpc": {
      "command": "node",
      "args": ["/absolute/path/to/packages/buildpc-mcp-server/dist/index.js"]
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
| `read_current_build` | `{ context_id }` | `BuildSnapshot` | DOM bridge read |
| `add_to_build` | `{ context_id, component }` | `BuildSnapshot` | DOM bridge add/verify |

Malformed/structurally invalid input returns `{ isError: true, content: [...] }`
instead of crashing the process. See [`../../specs/008-compiler-mcp-server/quickstart.md`](../../specs/008-compiler-mcp-server/quickstart.md)
for the full verification walkthrough.
