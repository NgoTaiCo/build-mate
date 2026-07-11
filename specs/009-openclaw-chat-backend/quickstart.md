# Quickstart & Validation: OpenClaw Chat Relay Backend

This guide proves the feature end-to-end. It assumes the OpenClaw gateway is running (see `docker/docker-compose.yml`) and reachable at `ws://localhost:18790`.

## Prerequisites

- Node.js 22.17 LTS, repo dependencies installed (`npm install` at repo root).
- OpenClaw gateway running with a known shared token (from `docker/openclaw.json` → `gateway.auth.token`).
- Package built or runnable via `tsx`.

## Step 1 — Generate the fixed device seed (once, ever)

Generate a 32-byte Ed25519 seed and record it as a base64url string. Keep it in your deployment secrets (do NOT commit to the repo).

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Set environment (example):
```bash
export OPENCLAW_GATEWAY_URL=ws://localhost:18790
export OPENCLAW_GATEWAY_TOKEN=<token from docker/openclaw.json>
export OPENCLAW_DEVICE_SEED=<the base64url seed from above>
export PORT=8790
```

## Step 2 — Start the backend

```bash
npm run -w @buildmate/chat-backend dev   # or: node --import tsx packages/chat-backend/src/index.ts
```

Expected log: backend listening on `:8790`, gateway state `connecting → authenticating`, and on first boot a `pairing_required` with the printed `deviceId`.

## Step 3 — Approve the device once

```bash
docker exec openclaw-gateway openclaw devices list --json     # find the pending requestId for your deviceId
docker exec openclaw-gateway openclaw devices approve <requestId> --token <token>
```

The backend re-handshakes and reaches gateway state `ready`. **This approval is permanent for that seed** — validating FR-005 / SC-002.

## Step 4 — Send a chat message (happy path, US1)

```bash
curl -s -X POST http://localhost:8790/chat \
  -H 'Content-Type: application/json' \
  -d '{"message":"Xin chào, bạn là ai?","sessionId":"demo-1"}' | jq
```

Expected: `200` with `{ "sessionId": "demo-1", "reply": "<assistant text>", "runId": "..." }`.
Contract: [contracts/http-chat.md](./contracts/http-chat.md).

## Step 5 — Verify approve-once across restarts (US2 / SC-002)

Restart the backend 5 times and re-run Step 4 each time:
```bash
# Ctrl-C then restart; repeat
```
Expected: no new pairing request appears in `openclaw devices list`; every restart reaches `ready` and Step 4 still returns a reply.

## Step 6 — Session isolation (SC-005)

```bash
curl -s -X POST http://localhost:8790/chat -H 'Content-Type: application/json' \
  -d '{"message":"Tên tôi là An","sessionId":"sess-A"}' | jq
curl -s -X POST http://localhost:8790/chat -H 'Content-Type: application/json' \
  -d '{"message":"Tên tôi là Bình","sessionId":"sess-B"}' | jq
curl -s -X POST http://localhost:8790/chat -H 'Content-Type: application/json' \
  -d '{"message":"Tôi tên gì?","sessionId":"sess-A"}' | jq
```
Expected: the third call's reply references "An", not "Bình" — replies stay bound to their session.

## Step 7 — Error paths (US3)

- **Validation** (no gateway call):
  ```bash
  curl -s -X POST http://localhost:8790/chat -H 'Content-Type: application/json' -d '{"sessionId":"x"}' | jq
  ```
  Expected `400 validation_error`.
- **Gateway down**: stop the gateway container, send a request → expect `502 gateway_unavailable` within 10s (SC-004).
- **Timeout**: with `REPLY_TIMEOUT_MS=1`, send a request → expect `504 timeout`.

## Step 8 — Health

```bash
curl -s http://localhost:8790/healthz | jq   # { "ok": true, "gateway": "ready", "deviceId": "..." }
```

## Automated checks (deterministic, no live gateway)

```bash
npm test -w @buildmate/chat-backend
```
Covers: V3 payload string format, `deviceId` derivation from a known seed, base64url public-key encoding, and reply-correlation logic (`runId` → pending request) against a mock socket. See [data-model.md](./data-model.md) and [contracts/gateway-connect.md](./contracts/gateway-connect.md).
