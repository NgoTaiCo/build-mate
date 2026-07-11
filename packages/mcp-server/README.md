# @buildmate/mcp-server

Standalone MCP (Model Context Protocol) server that exposes the deterministic
[`@buildmate/compiler`](../compiler) trust layer as three MCP tools:
`compile_build`, `detect_errors`, `repair_build`. The server only wraps and
dispatches to the Compiler — it adds no compatibility logic of its own.

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

## Test / typecheck

```sh
cd packages/mcp-server
npm test          # dispatch-level tests + InMemoryTransport protocol round-trip
npm run typecheck # tsc --noEmit strict
```

## Connect an MCP client

```json
{
  "mcpServers": {
    "buildmate-compiler": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/packages/mcp-server/src/index.ts"]
    }
  }
}
```

After `npm run build`, use `"command": "node", "args": ["dist/index.js"]` instead.

## Tools

| Tool | Input | Output | Equivalent to |
|---|---|---|---|
| `compile_build` | `{ build }` | `CompilerResult` (`errors`, `repair_plan`, `is_valid`) | `compileBuild(build)` |
| `detect_errors` | `{ build }` | `CompilerError[]` | `detectErrors(build)` |
| `repair_build` | `{ build, errors }` | `RepairPlan[]` (1:1 with `errors`) | `repairBuild(build, errors)` |

Malformed/structurally invalid input returns `{ isError: true, content: [...] }`
instead of crashing the process. See [`../../specs/008-compiler-mcp-server/quickstart.md`](../../specs/008-compiler-mcp-server/quickstart.md)
for the full verification walkthrough.
