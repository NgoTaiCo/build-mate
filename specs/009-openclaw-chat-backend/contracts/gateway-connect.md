# Contract: Backend ↔ OpenClaw Gateway (WebSocket)

Transport: WebSocket to `OPENCLAW_GATEWAY_URL` (default `ws://localhost:18790`). Protocol 4. This mirrors the exact frames validated in `openclaw-client.html`.

## 1. Challenge (gateway → backend)

On connect, the gateway emits:
```json
{ "type": "event", "event": "connect.challenge", "payload": { "nonce": "<uuid>", "ts": 1783763371228 } }
```

## 2. Connect request (backend → gateway)

```json
{
  "type": "req",
  "id": "req_<unique>",
  "method": "connect",
  "params": {
    "minProtocol": 4,
    "maxProtocol": 4,
    "client": { "id": "webchat-ui", "mode": "webchat", "version": "1.0.0", "platform": "web", "deviceFamily": "web" },
    "role": "operator",
    "scopes": ["operator.read", "operator.write"],
    "auth": { "token": "<OPENCLAW_GATEWAY_TOKEN>" },
    "device": {
      "id": "<hex sha256 of raw pubkey>",
      "publicKey": "<base64url raw 32-byte ed25519 pubkey>",
      "signature": "<base64url ed25519 signature of V3 payload>",
      "signedAt": 1783763371228,
      "nonce": "<nonce from challenge>"
    }
  }
}
```

### V3 signature payload (exact string, pipe-delimited)
```
v3|{deviceId}|{clientId}|{clientMode}|{role}|{scopes.join(',')}|{signedAtMs}|{token}|{nonce}|{platform}|{deviceFamily}
```
- `platform` and `deviceFamily` lowercased.
- `signedAtMs === ts` from the challenge.
- Signed with the fixed device private key; signature base64url-encoded.

## 3. Connect response (gateway → backend)

Success:
```json
{ "type": "res", "id": "req_<unique>", "ok": true,
  "payload": { "type": "hello-ok", "protocol": 4, "auth": { "deviceToken": "<token>", ... }, "server": { "connId": "..." } } }
```
Store `payload.auth.deviceToken` and `payload.server.connId` for the connection's lifetime.

Failure cases (map to HTTP errors per http-chat.md):
- `error.details.code === "PAIRING_REQUIRED"` → `pairing_required` (425). Log the `deviceId` so an operator can approve.
- `error.code === "AUTH_TOKEN_MISMATCH"` / signature/device errors → `auth_failed` (502).
- `PROTOCOL_MISMATCH` → `auth_failed` (502) with detail (should not happen at protocol 4).

## 4. Send a message (backend → gateway)

```json
{
  "type": "req",
  "id": "req_<unique>",
  "method": "chat.send",
  "params": {
    "sessionKey": "agent:main:<sessionId>",
    "agentId": "main",
    "message": "<user text>",
    "idempotencyKey": "<uuid>"
  }
}
```

Response acknowledges with a run id:
```json
{ "type": "res", "id": "req_<unique>", "ok": true, "payload": { "runId": "<runId>", "status": "..." } }
```

## 5. Receive the reply (gateway → backend, broadcast event)

```json
{
  "type": "event",
  "event": "chat",
  "payload": {
    "runId": "<runId>",
    "sessionKey": "agent:main:<sessionId>",
    "seq": 3,
    "state": "final",
    "message": { "role": "assistant", "content": [ { "type": "text", "text": "..." } ], "timestamp": 1783763400000 }
  }
}
```

- Correlate by `runId` (fallback `sessionKey`) to the pending request.
- Extract reply text = concatenation of `message.content[].text` where `type === "text"`.
- `state: "final"` → resolve success. `state: "error"` → `gateway_error`. Ignore `partial`/`delta` and noise events (`tick`, `heartbeat`, `presence`, `health`).

## 6. Reconnect

On socket close, transition to `connecting` and repeat steps 1–3 (transport only — no session replay). In-flight pending requests are rejected (`gateway_unavailable`) and their timers cleared.
