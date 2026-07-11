# Phase 0 Research: OpenClaw Chat Relay Backend

All decisions below are derived from the working reference client `openclaw-client.html` (empirically validated against the live gateway during the 003 session) and the gateway source inspected in the running container (`/app/dist/*.js`). No open `NEEDS CLARIFICATION` remain.

## Decision 1 — Runtime & package layout

- **Decision**: New npm-workspace package `packages/chat-backend`, ESM TypeScript 5.x on Node.js 22.17 LTS, tested with `node --import tsx --test`.
- **Rationale**: Matches `packages/mcp-server` exactly, so tooling, tsconfig, and CI (`npm test --workspaces`) work unchanged. Node 22 LTS ships stable Ed25519 and WebSocket-capable ecosystem.
- **Alternatives considered**: Standalone repo (rejected — fragments the monorepo); Deno/Bun (rejected — inconsistent with existing packages and Docker base image).

## Decision 2 — Cryptography: `node:crypto` instead of tweetnacl

- **Decision**: Use Node's built-in `node:crypto` for Ed25519 keygen and signing.
- **Rationale**: Verified in-environment that `crypto.generateKeyPairSync('ed25519')` + `crypto.sign(null, data, privateKey)` yields the 64-byte signature the gateway expects. The browser client only used tweetnacl because Web Crypto lacked Ed25519; on Node the built-in is sufficient, removing a dependency (Principle: minimal deps).
- **Key detail**: The gateway expects the **raw 32-byte public key** base64url-encoded, and `deviceId = hex(SHA-256(raw 32-byte public key))`. In Node, export the raw public key via the JWK `x` field (base64url) or DER slice; hash the raw bytes for the fingerprint. Signature is base64url of the raw Ed25519 signature.
- **Alternatives considered**: tweetnacl (rejected — unnecessary dep); libsodium (rejected — heavy native build).

## Decision 3 — Fixed device identity (the core requirement)

- **Decision**: Store a **fixed Ed25519 seed** (32 bytes) in configuration (`OPENCLAW_DEVICE_SEED`, base64url). The keypair is deterministically derived from this seed at start-up, giving a stable `deviceId` across restarts. Approve once on the gateway.
- **Rationale**: The user explicitly requires approve-once. A fixed seed → fixed public key → fixed deviceId → single pairing approval that survives restarts and redeploys (SC-002). The browser client's `localStorage` persistence is replaced by config-sourced determinism.
- **Operational note**: Generate the seed once (documented in quickstart.md), commit it to the deployment's secret config (NOT to the repo). First boot triggers one `PAIRING_REQUIRED`; operator approves via `docker exec ... openclaw devices approve <requestId>`; done forever for that seed.
- **Alternatives considered**: Persisted keyfile on a Docker volume (viable, but config seed is simpler and explicitly "fixed in code/config" as requested); random per-boot (rejected — violates the requirement).

## Decision 4 — Handshake protocol (proven values)

- **Decision**: Reproduce the exact connect request that succeeded:
  - `minProtocol: 4, maxProtocol: 4`
  - `client: { id: "webchat-ui", mode: "webchat", version, platform: "web", deviceFamily: "web" }`
  - `role: "operator"`, `scopes: ["operator.read", "operator.write"]`
  - `auth: { token }` (gateway shared token)
  - `device: { id, publicKey, signature, signedAt, nonce }`
  - V3 signature payload: `v3|deviceId|clientId|clientMode|role|scopes.join(',')|signedAtMs|token|nonce|platform|deviceFamily` (platform/deviceFamily lowercased).
- **Rationale**: This is the payload the gateway accepted (`hello-ok`, protocol 4). Any deviation reproduces the earlier failures (PROTOCOL_MISMATCH at v3, DEVICE_ID_MISMATCH, SIGNATURE_INVALID).
- **Flow**: open socket → receive `connect.challenge` event `{ nonce, ts }` → build+sign V3 payload with `signedAt = ts` → send `connect` req → expect `res { ok: true, payload.type: "hello-ok" }` (store `payload.auth.deviceToken`).
- **Alternatives considered**: `Skip Device Auth` path (rejected — gateway still enforces token+device; not a real bypass).

## Decision 5 — Sending a message & receiving the reply

- **Decision**: Send `chat.send` with `{ sessionKey, agentId: "main", message, idempotencyKey }`. Await the assistant reply from the broadcast `chat` event whose `state === "final"`, extracting text from `payload.message.content[].text`.
- **Rationale**: Confirmed against gateway source: `chat.send` params validate `sessionKey` (required) + `message` (string); the internal client (`gateway-chat-*.js`) uses exactly these fields. Final replies are broadcast via `broadcastChatFinal` as `event: "chat"`, `state: "final"`, `message: projectChatDisplayMessage(...)`. Errors arrive as `state: "error"` with a message.
- **Correlation**: `chat.send` returns `{ runId, status }`; the `chat` final event carries the same `runId` and `sessionKey`. Correlate the awaiting HTTP request by `runId` (fallback `sessionKey`). This is **short-lived in-memory correlation**, not a session store.
- **Alternatives considered**: `agent` / `sessions.send` methods (rejected — `chat.send` is the validated path); polling `chat.history` (rejected — event-driven is lower latency and matches SC-003).

## Decision 6 — sessionId → sessionKey mapping

- **Decision**: Map the frontend `sessionId` to the OpenClaw session key `agent:main:<sessionId>` by default; if the frontend passes a value already shaped like a full session key (contains `:`), forward it verbatim.
- **Rationale**: The gateway snapshot showed `mainSessionKey: "agent:main:main"` and `scope: "per-sender"`. Namespacing by `agent:main:<sessionId>` gives each frontend session its own OpenClaw session while letting OpenClaw own the actual history (Principle I). Pass-through of full keys keeps power users unblocked.
- **Alternatives considered**: Global single session (rejected — violates SC-005 isolation); backend-generated session map (rejected — that would be a SessionStore, violating Principle I).

## Decision 7 — Frontend-facing transport

- **Decision**: A single `POST /chat` endpoint on a `node:http` server, JSON in/out, permissive CORS for the demo FE, synchronous response (FE waits for reply). Health check `GET /healthz`.
- **Rationale**: One endpoint keeps the shim minimal; `node:http` avoids a framework dependency. Synchronous request/response matches the spec's out-of-scope note on streaming and satisfies SC-003.
- **Alternatives considered**: Express/Fastify (rejected for now — extra dep for one route); SSE/WebSocket streaming to FE (deferred — explicitly out of scope for v1).

## Decision 8 — Reconnect & timeouts

- **Decision**: Lazy/eager single persistent gateway connection with automatic reconnect + re-handshake on drop (transport only). Per-request reply timeout (default 60s, configurable) → return a timeout error and free the pending correlation entry.
- **Rationale**: FR-013 (auto-reconnect) and FR-010 (bounded wait). Reconnect restores only the socket + auth, never replays sessions (OpenClaw owns them). Timeout prevents hung FE requests (SC-004).
- **Alternatives considered**: New socket per request (rejected — re-handshake cost per message); no timeout (rejected — violates SC-004).
