# Quickstart: Compiler MCP Server

**Branch**: `008-compiler-mcp-server` | **Date**: 2026-07-11
**Mục đích**: verify server độc lập (FR-010) — bất kỳ MCP client chuẩn nào cũng dùng được, không riêng OpenClaw.

## Prerequisite

- Node.js ≥ 22.17 LTS.
- Repo cloned, ở branch `008-compiler-mcp-server`.
- `packages/compiler` (001) đã implement — server này wrap nó.

## Install (root workspaces — mới tạo bởi feature này)

```sh
# Từ repo root
npm install     # cài root + tất cả packages/* workspace, bao gồm packages/compiler và packages/mcp-server
```

## Verify standalone (dispatch-level + protocol round-trip)

```sh
cd packages/mcp-server
npm test          # node:test — dispatch-level tests + InMemoryTransport protocol round-trip (research.md §5)
npm run typecheck # tsc --noEmit strict
```

**Expected**: tất cả test pass, 0 typecheck error. Test suites: compile-build-tool / detect-errors-tool / repair-build-tool / error-handling / protocol-roundtrip.

## Run the server manually (dev mode)

```sh
cd packages/mcp-server
npx tsx src/index.ts
```

Server sẽ block chờ trên stdin theo MCP stdio framing (không có output nếu chưa có client kết nối — đây là hành vi đúng).

## Connect a generic MCP client (proof of FR-006/FR-010)

Bất kỳ MCP client chuẩn nào cấu hình process launch tương tự:

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

(Sau `npm run build`, thay bằng `"command": "node", "args": ["dist/index.js"]`.)

**Expected sau khi connect**:
1. Client's tool list hiển thị `compile_build`, `detect_errors`, `repair_build` kèm input schema.
2. Gọi `compile_build` với build có socket mismatch (build mẫu — xem `001-build-compiler-core/quickstart.md`) → trả `CompilerResult` với `errors[0].code === "E001"`.
3. Gọi `detect_errors` rồi `repair_build` với cùng build/errors → `repair_plan.length === errors.length`, mỗi fix constraint-based.

## Smoke scenario — malformed input does not crash the server (FR-009)

Gọi `compile_build` với `{ build: "not-an-object" }` (hoặc `{ build: { components: "not-an-array" } }`):

**Expected**: response có `isError: true` kèm message mô tả lỗi structural; process server **vẫn sống**, sẵn sàng nhận call tiếp theo.

## Determinism check (FR-007, SC-003)

Gọi `compile_build` 2 lần với cùng build → 2 response phải giống hệt nhau (`JSON.stringify` equal).

## What this quickstart does NOT cover

- OpenClaw's native tool-plugin SDK wiring (`003-wire-openclaw-plugins`) — con đường riêng, không phải MCP.
- Catalog / `search_components` — `packages/catalog` (002) chưa implement.
- Networked transport (HTTP/SSE) — chỉ stdio trong scope này (research.md §2).
- `add_to_build`, `guide_checkout` — ngoài phạm vi.

Compiler MCP Server = protocol binding layer verify độc lập; wiring vào 1 agent runtime cụ thể (OpenClaw hay khác) là việc của layer gọi server này, không phải feature này.
