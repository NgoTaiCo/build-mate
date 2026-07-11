---
description: "Task list for OpenClaw Chat Relay Backend implementation"
---

# Tasks: OpenClaw Chat Relay Backend

**Input**: Design documents from `/specs/009-openclaw-chat-backend/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Unit tests for the deterministic modules (`device-auth`, reply correlation) are INCLUDED because the Constitution Quality Gates require independent unit tests for deterministic logic. End-to-end validation is via quickstart.md, not automated tests.

**Organization**: Tasks grouped by user story. US1 and US2 are both P1; the shared gateway connection is a blocking prerequisite placed in Foundational.

## Path Conventions

New npm-workspace package at `packages/chat-backend/` (mirrors `packages/mcp-server`). All paths below are repo-relative.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Scaffold the workspace package so it builds, runs via `tsx`, and tests via `node --test`.

- [X] T001 Create `packages/chat-backend/package.json` — name `@buildmate/chat-backend`, `type: module`, deps `ws` ^8, `zod` ^3; devDeps `tsx` ^4, `typescript` ^5, `@types/node` ^22, `@types/ws`; scripts `dev` (`node --import tsx src/index.ts`), `test` (`node --import tsx --test tests/*.test.ts`), `typecheck` (`tsc --noEmit`), `build` (`tsc`)
- [X] T002 [P] Create `packages/chat-backend/tsconfig.json` — ESM, target ES2022, `moduleResolution` NodeNext, `strict`, `outDir dist`, matching `packages/mcp-server/tsconfig.json`
- [X] T003 Run `npm install` at repo root to register the new workspace (root `workspaces: packages/*`), then `npm run -w @buildmate/chat-backend typecheck` to confirm the empty package compiles

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Config, request/response schemas, the pure Ed25519 device-auth module, and the authenticated gateway connection. Every user story needs an authenticated socket, so it lives here.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T004 [P] Implement `packages/chat-backend/src/config.ts` — load & validate env into `BackendConfig` (`OPENCLAW_GATEWAY_URL` default `ws://localhost:18790`, `OPENCLAW_GATEWAY_TOKEN` required, `OPENCLAW_DEVICE_SEED` required base64url, `PORT` default 8790, `REPLY_TIMEOUT_MS` default 60000, `DEFAULT_AGENT_ID` default `main`); throw a clear error if a required secret is missing; never include secret values in error messages (FR-012)
- [X] T005 [P] Implement `packages/chat-backend/src/schemas.ts` — zod schemas for `ChatRequest` (`message` non-empty, `sessionId` non-empty, `agentId` optional), `ChatReply`, `ErrorReply` per [data-model.md](./data-model.md)
- [X] T006 Implement `packages/chat-backend/src/device-auth.ts` (PURE) — `seedToKeyPair(seedB64url)` via `node:crypto` Ed25519; `publicKeyRawBase64url()`; `deviceId = hex(SHA-256(rawPublicKey))`; `buildV3Payload({deviceId,clientId,clientMode,role,scopes,signedAtMs,token,nonce,platform,deviceFamily})` producing the exact pipe string from [contracts/gateway-connect.md](./contracts/gateway-connect.md); `sign(payload)` → base64url signature. No I/O, no globals.
- [X] T007 [P] Unit test `packages/chat-backend/tests/device-auth.test.ts` — with a fixed known seed assert: deterministic `deviceId` (stable across calls), raw pubkey base64url length/format, exact V3 payload string, signature is 64-byte Ed25519 encoded base64url and verifies against the public key (Quality Gate)
- [X] T008 Implement `packages/chat-backend/src/gateway-client.ts` connection + handshake — open `ws` to `gatewayUrl`; on `connect.challenge` event build+sign V3 payload with `signedAt = ts` and send the `connect` req (client `webchat-ui`/`webchat`, role `operator`, scopes read+write, protocol 4) per contract; parse `res` `hello-ok`, store `deviceToken`/`connId`; expose a `state` getter (`connecting|authenticating|ready|closed`)

**Checkpoint**: Backend authenticates to the gateway and reaches `ready` (this already exercises device auth end-to-end once).

---

## Phase 3: User Story 1 - Send a chat message and get the assistant reply (Priority: P1) 🎯 MVP

**Goal**: FE `POST /chat { message, sessionId }` → assistant's final reply text.

**Independent Test**: With the device already approved, `curl` a single `POST /chat` and receive a coherent reply (quickstart Step 4); two different `sessionId`s stay isolated (Step 6).

- [ ] T009 [US1] Add pure `sessionKeyFor(sessionId, agentId)` in `packages/chat-backend/src/gateway-client.ts` — if `sessionId` contains `:` forward verbatim, else `agent:${agentId}:${sessionId}` (see [data-model.md](./data-model.md) mapping)
- [ ] T010 [US1] Implement `sendChat({sessionKey, agentId, message})` + reply correlation in `packages/chat-backend/src/gateway-client.ts` — send `chat.send` with `idempotencyKey`; keep a `pending` Map keyed by returned `runId`; on `chat` event with `state === 'final'` matching `runId` (fallback `sessionKey`) resolve with `extractChatText(payload.message)` (join `content[].text`); ignore `partial`/`delta` and noise events (`tick`,`heartbeat`,`presence`,`health`)
- [ ] T011 [P] [US1] Unit test `packages/chat-backend/tests/gateway-client.test.ts` — drive correlation logic against a mock socket: `chat.send` ack `runId` → matching `chat` final event resolves the correct pending promise; `extractChatText` handles string and `content[]` array; unrelated `runId` does not resolve (Quality Gate, SC-005)
- [ ] T012 [US1] Implement `packages/chat-backend/src/http-server.ts` — `node:http` server; `POST /chat`: read JSON body, validate via `ChatRequest` schema (400 `validation_error` on failure, no gateway call — FR-007), map session, `await gateway.sendChat(...)`, return 200 `{ sessionId, reply, runId }`
- [ ] T013 [US1] Wire `packages/chat-backend/src/index.ts` — load config, construct device identity, start gateway connection, start HTTP server; log bound port and `deviceId`

**Checkpoint**: `POST /chat` returns an assistant reply; distinct sessionIds don't cross (US1 fully functional).

---

## Phase 4: User Story 2 - Fixed device identity approved only once (Priority: P1)

**Goal**: One fixed identity from config, approved once, survives restarts with no re-pairing.

**Independent Test**: Approve once, restart the backend ≥5 times, confirm no new pairing request and chat keeps working (quickstart Steps 3 & 5, SC-002).

- [ ] T014 [US2] Guarantee identity comes ONLY from the fixed config seed — in `packages/chat-backend/src/index.ts`/`config.ts` confirm no random generation and no filesystem/`localStorage` persistence path; the same `OPENCLAW_DEVICE_SEED` always yields the same `deviceId` (FR-004, FR-005)
- [ ] T015 [US2] Handle first-boot pairing in `packages/chat-backend/src/gateway-client.ts` — detect `PAIRING_REQUIRED` in the connect `res`, log the `deviceId` and remediation hint, set state accordingly, and keep the connection retrying so that after operator approval it reaches `ready` without a manual restart
- [ ] T016 [US2] Implement `GET /healthz` in `packages/chat-backend/src/http-server.ts` — return `{ ok, gateway: <state>, deviceId }` (deviceId is public; used by operators to run `openclaw devices approve`)

**Checkpoint**: After one approval, repeated restarts reach `ready` with zero new pairing requests.

---

## Phase 5: User Story 3 - Clear, actionable errors (Priority: P2)

**Goal**: Every failure returns a clear FE-safe error quickly instead of hanging or leaking protocol details.

**Independent Test**: Gateway down → `gateway_unavailable` within 10s; unapproved → `pairing_required`; `REPLY_TIMEOUT_MS=1` → `timeout` (quickstart Step 7, SC-004).

- [ ] T017 [US3] Implement error taxonomy mapping across `packages/chat-backend/src/gateway-client.ts` and `src/http-server.ts` — `validation_error`→400, `pairing_required`→425, `gateway_unavailable`→502, `auth_failed`→502, `gateway_error`→502 (from `chat` `state:'error'`), `timeout`→504; messages FE-safe, secrets stripped (FR-008, FR-012)
- [ ] T018 [US3] Add per-request reply timeout + pending eviction in `packages/chat-backend/src/gateway-client.ts` — arm `replyTimeoutMs` timer per pending entry; on expiry reject with `timeout` and remove the entry (FR-010)
- [ ] T019 [US3] Add reconnect + in-flight rejection in `packages/chat-backend/src/gateway-client.ts` — on socket close reject all pending with `gateway_unavailable`, clear timers, transition to `connecting`, auto-reconnect and re-handshake (transport only, no session replay — FR-013)
- [ ] T020 [US3] Add permissive CORS and malformed-JSON handling in `packages/chat-backend/src/http-server.ts` — respond to preflight, reject non-JSON bodies with `validation_error`

**Checkpoint**: All error paths return correct codes within 10s; no hangs.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T021 [P] Write `packages/chat-backend/README.md` — env vars, one-time seed generation, approve-once flow, `POST /chat` + `GET /healthz` (Vietnamese prose, English technical terms, no emoji — Principle V)
- [ ] T022 [P] Audit logging in `packages/chat-backend/src/*.ts` — assert gateway token and device private key never appear in any log line or response (FR-012)
- [ ] T023 Run `packages/chat-backend` through [quickstart.md](./quickstart.md) end-to-end (Steps 1–8) against the live gateway
- [ ] T024 [P] Confirm `npm test -w @buildmate/chat-backend` and `npm run -w @buildmate/chat-backend typecheck` are green (Quality Gate before demo)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies.
- **Foundational (Phase 2)**: depends on Setup; BLOCKS all user stories (shared gateway connection + device auth).
- **US1 (Phase 3)**: depends on Foundational (needs authenticated socket from T008).
- **US2 (Phase 4)**: depends on Foundational; verifies the approve-once property of the identity built in T006/T008.
- **US3 (Phase 5)**: depends on Foundational; refines error/timeout/reconnect behavior around US1's request path.
- **Polish (Phase 6)**: depends on all targeted stories.

### User Story Dependencies

- **US1 (P1)** and **US2 (P1)** are independent of each other once Foundational is done — US1 exercises the request/reply path, US2 exercises identity stability. Both rely only on the shared connection.
- **US3 (P2)** hardens the paths US1/US2 use; best done after US1 exists but is independently testable via error injection.

### Within Each User Story

- Unit tests (T007, T011) sit beside the module they cover; write/verify them as the module lands.
- `gateway-client.ts` is edited across T008→T010→T015→T017→T018→T019 — these touch the same file and are therefore mostly **sequential**, not `[P]`.

### Parallel Opportunities

- Setup: T002 [P] alongside T001.
- Foundational: T004 [P] and T005 [P] (different files) in parallel; T007 [P] once T006 lands.
- US1: T011 [P] (test file) parallel to endpoint work once T010 exists.
- Polish: T021, T022, T024 [P] in parallel.

---

## Parallel Example: Foundational

```bash
# Different files, no interdependency:
Task: "Implement src/config.ts env loader"        # T004
Task: "Implement src/schemas.ts zod schemas"      # T005
# After device-auth.ts (T006) lands:
Task: "Unit test tests/device-auth.test.ts"       # T007
```

---

## Implementation Strategy

### MVP First (US1)

1. Phase 1 Setup → 2. Phase 2 Foundational (authenticated connection) → 3. Phase 3 US1 → **STOP & VALIDATE** quickstart Step 4/6 → demo the relay.

### Incremental Delivery

1. Setup + Foundational → connection authenticates.
2. US1 → `POST /chat` returns replies (MVP, headline value).
3. US2 → approve-once verified across restarts (operational reliability).
4. US3 → robust errors/timeouts/reconnect.
5. Polish → docs, secret-logging audit, full quickstart + tests green.

---

## Notes

- [P] = different files, no dependency; most `gateway-client.ts` edits are sequential by design.
- The backend stays stateless (Constitution I): no session store, no idempotency layer, transport-only reconnect.
- Commit after each task or logical group (project rule: conventional commits).
- The proven reference is `openclaw-client.html` — port its handshake/chat logic to Node, replacing tweetnacl with `node:crypto` and `localStorage` with the fixed config seed.
