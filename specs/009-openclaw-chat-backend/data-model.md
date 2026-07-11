# Phase 1 Data Model: OpenClaw Chat Relay Backend

The backend is **stateless** (Constitution Principle I). Nothing below is persisted to disk or a database. Entities are either (a) request/response payloads on the wire, (b) fixed configuration loaded at boot, or (c) short-lived in-memory values that live only for the duration of one request or one socket connection.

## Wire entities (frontend ↔ backend)

### ChatRequest (FE → backend)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `message` | string | yes | Non-empty after trim. The user's chat text. |
| `sessionId` | string | yes | Non-empty. Identifies the conversation; mapped to an OpenClaw session key. |
| `agentId` | string | no | Defaults to `"main"`. Selects the OpenClaw agent. |

Validation (FR-007): reject with `400` if `message` or `sessionId` is missing/empty — without contacting the gateway.

### ChatReply (backend → FE, success)

| Field | Type | Notes |
|-------|------|-------|
| `sessionId` | string | Echoes the request's sessionId. |
| `reply` | string | Assistant's final reply text (joined text parts). |
| `runId` | string | The gateway run id that produced the reply (traceability). |

### ErrorReply (backend → FE, failure)

| Field | Type | Notes |
|-------|------|-------|
| `error` | string | Stable machine code: `validation_error`, `gateway_unavailable`, `pairing_required`, `auth_failed`, `timeout`, `gateway_error`. |
| `message` | string | Human-readable, frontend-safe. Never contains token or private key (FR-012). |

## Configuration entity (loaded once at boot)

### BackendConfig

| Field | Env var | Type | Notes |
|-------|---------|------|-------|
| `gatewayUrl` | `OPENCLAW_GATEWAY_URL` | string | Default `ws://localhost:18790`. |
| `gatewayToken` | `OPENCLAW_GATEWAY_TOKEN` | string (secret) | Shared gateway token. Required. Never logged. |
| `deviceSeed` | `OPENCLAW_DEVICE_SEED` | string (secret, base64url, 32 bytes) | **Fixed** Ed25519 seed → stable identity. Required. Never logged. |
| `httpPort` | `PORT` | number | Default `8790`. FE-facing HTTP port. |
| `replyTimeoutMs` | `REPLY_TIMEOUT_MS` | number | Default `60000`. Bounded wait for a reply (FR-010). |
| `defaultAgentId` | `DEFAULT_AGENT_ID` | string | Default `"main"`. |

## Derived identity (computed at boot from `deviceSeed`, never persisted)

### DeviceIdentity

| Field | Derivation | Notes |
|-------|------------|-------|
| `publicKeyRaw` | Ed25519 public key (32 bytes) from seed | Sent base64url-encoded as `device.publicKey`. |
| `privateKey` | Ed25519 private key from seed | In-memory only; used to sign; never logged/returned (FR-012). |
| `deviceId` | `hex(SHA-256(publicKeyRaw))` | Stable across restarts because seed is fixed → approve once (FR-004, FR-005, SC-002). |

## Connection-scoped values (live only while a socket is open)

### GatewaySession (in-memory, transport only — NOT an OpenClaw session)

| Field | Type | Notes |
|-------|------|-------|
| `socket` | WebSocket | The live connection to the gateway. |
| `state` | enum | `connecting` → `authenticating` → `ready` → `closed`. |
| `deviceToken` | string | From `hello-ok` `payload.auth.deviceToken`; kept for the connection's life; not persisted. |
| `pending` | Map<runId, PendingRequest> | Short-lived correlation table (see below). |

> This is explicitly **not** a session store: it holds no chat history, survives no restart, and is keyed by transport `runId`, not by user session. OpenClaw remains the source of truth for sessions.

### PendingRequest (one per in-flight FE request)

| Field | Type | Notes |
|-------|------|-------|
| `runId` | string | Returned by `chat.send`; correlates the `chat` final event. |
| `sessionKey` | string | Fallback correlation key. |
| `resolve` / `reject` | callback | Settles the awaiting HTTP handler. |
| `timer` | timeout handle | Fires `timeout` error after `replyTimeoutMs`, then evicts the entry. |

## Session key mapping (function, not stored)

`sessionId → sessionKey`:
- If `sessionId` contains `:` → treat as a full session key, forward verbatim.
- Else → `agent:${agentId}:${sessionId}` (default `agent:main:<sessionId>`).

## State transitions

**Gateway connection**: `connecting → authenticating → ready → (closed → connecting)` on drop (auto-reconnect, FR-013).

**Pending request**: `created → (resolved on chat final | rejected on chat error | rejected on timeout | rejected on socket close)`; always removed from `pending` on settle.
