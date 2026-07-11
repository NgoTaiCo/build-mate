# Implementation Plan: OpenClaw Chat Relay Backend

**Branch**: `009-openclaw-chat-backend` | **Date**: 2026-07-11 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/009-openclaw-chat-backend/spec.md`

## Summary

A thin, stateless HTTP backend that lets a frontend send `{ message, sessionId }` and receive the assistant's reply. The backend relays each message to the OpenClaw gateway over a WebSocket connection using the exact handshake proven in `openclaw-client.html` (protocol 4, V3 Ed25519 device auth, `chat.send` → `chat` event). The device identity is **fixed in configuration** (Ed25519 seed) so it is approved on the gateway exactly once. All session state, memory, and routing stay in OpenClaw (Constitution Principle I); the backend owns only the transport connection and short-lived request↔reply correlation.

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 22.17 LTS (đồng bộ với `packages/mcp-server`, `packages/compiler`)  
**Primary Dependencies**: `ws` (^8.x — WebSocket client to gateway); Node built-in `node:http` (frontend-facing endpoint) and `node:crypto` (Ed25519 sign — natively supported, no tweetnacl); `zod` (^3.x — request validation, consistent with other packages)  
**Storage**: N/A — stateless. No session store, no DB. Fixed device seed comes from config/env; OpenClaw persists session/memory.  
**Testing**: `node --import tsx --test tests/*.test.ts` (đồng bộ với `packages/mcp-server`)  
**Target Platform**: Linux server / Docker (same host reachability as gateway `ws://localhost:18790`)  
**Project Type**: Web service (backend relay) — new workspace package `packages/chat-backend`  
**Performance Goals**: Single short-prompt round-trip returns within the assistant's normal latency; clear error within 10s on failure (SC-004)  
**Constraints**: Stateless transport shim only — MUST NOT build SessionStore / idempotency / session keep-alive (Constitution I). Bounded reply timeout (FR-010). Secrets never logged (FR-012).  
**Scale/Scope**: Hackathon-scale — handful of concurrent sessions; correctness of reply↔session correlation matters more than throughput (SC-005).

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle | Verdict | Notes |
|-----------|---------|-------|
| **I. OpenClaw owns Session & Memory** | ✅ PASS (with discipline) | Backend is a **stateless transport shim**. It does NOT persist sessions, does NOT implement idempotency dedup, does NOT keep sessions alive. `sessionId` is forwarded to OpenClaw's session key; OpenClaw owns history/compaction/memory. FR-013 reconnect is **transport-level** (re-open a dropped socket), not session keep-alive. The Hackathon fallback clause explicitly endorses "BE nhỏ" as a thin layer. |
| **II. Compiler = Deterministic Trust Layer** | ✅ N/A | Feature does not touch the compiler. No compatibility logic added. |
| **III. Model = Provider Config** | ✅ PASS | No orchestrator/LangChain added. Model selection stays in OpenClaw's `openclaw.json`; backend never talks to a model provider directly. |
| **IV. WebChat = Channel Primary** | ✅ PASS (note) | This backend is a thin programmatic relay for a custom FE; it does not replace WebChat and adds no competing channel plugin. WebChat remains primary. |
| **V. Docs VN + English terms, tests, no emoji in code** | ✅ PASS | Deterministic transport logic (auth payload builder, reply correlation) gets unit tests independent of a live gateway. Docs in Vietnamese with English technical terms. No emoji in source. |

**Result**: PASS. No violations requiring Complexity Tracking. The single risk is scope-creep into a stateful gateway; the design keeps the backend stateless by construction (see data-model.md — no persisted entities).

## Project Structure

### Documentation (this feature)

```text
specs/009-openclaw-chat-backend/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── http-chat.md     # FE-facing HTTP contract
│   └── gateway-connect.md # Backend↔OpenClaw WS handshake/relay contract
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created here)
```

### Source Code (repository root)

```text
packages/chat-backend/
├── package.json          # @buildmate/chat-backend workspace package
├── tsconfig.json
├── src/
│   ├── index.ts          # Entry: read config, start HTTP server + gateway connection
│   ├── config.ts         # Load host/port/token/device seed from env (validated)
│   ├── http-server.ts    # node:http server, POST /chat endpoint, CORS, validation
│   ├── gateway-client.ts # WS client: connect, V3 Ed25519 handshake, chat.send, reply correlation, reconnect
│   ├── device-auth.ts    # Fixed Ed25519 identity: seed→keypair, deviceId fingerprint, V3 payload, sign (PURE, unit-tested)
│   └── schemas.ts        # zod schemas for request/response
└── tests/
    ├── device-auth.test.ts   # Deterministic: payload format, deviceId derivation, signature shape
    └── gateway-client.test.ts# Reply correlation logic (runId ↔ request) against a mock socket
```

**Structure Decision**: New workspace package `packages/chat-backend`, mirroring `packages/mcp-server` conventions (ESM TypeScript, `tsx` + `node --test`, zod). The proven browser logic in `openclaw-client.html` is ported to Node: Web Crypto/tweetnacl → `node:crypto` Ed25519; `localStorage` keypair persistence → a **fixed seed from config** (the core requirement). `device-auth.ts` is a pure module unit-tested without a live gateway, satisfying Quality Gates and Principle V.

## Complexity Tracking

> No Constitution violations. Table intentionally empty.
