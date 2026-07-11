# Contract: Frontend-facing HTTP API

Base: `http://<host>:<PORT>` (default `PORT=8790`). JSON request/response. Permissive CORS for the demo frontend.

## POST /chat

Relay one chat message to OpenClaw and return the assistant's final reply (synchronous — the caller waits).

### Request

Headers: `Content-Type: application/json`

Body:
```json
{
  "message": "Tư vấn giúp tôi build PC 20 triệu",
  "sessionId": "user-42",
  "agentId": "main"
}
```

- `message` (string, required, non-empty after trim)
- `sessionId` (string, required, non-empty)
- `agentId` (string, optional, default `"main"`)

### Response 200 — success
```json
{
  "sessionId": "user-42",
  "reply": "Với 20 triệu, tôi đề xuất ...",
  "runId": "b0e1..."
}
```

### Response 400 — validation_error
```json
{ "error": "validation_error", "message": "message and sessionId are required" }
```
Gateway is NOT contacted (FR-007).

### Response 425 — pairing_required
```json
{ "error": "pairing_required", "message": "Device chưa được approve trên gateway. Approve rồi thử lại." }
```

### Response 502 — gateway_unavailable
```json
{ "error": "gateway_unavailable", "message": "Không kết nối được tới OpenClaw gateway." }
```

### Response 502 — auth_failed
```json
{ "error": "auth_failed", "message": "Xác thực gateway thất bại (token hoặc device)." }
```

### Response 502 — gateway_error
```json
{ "error": "gateway_error", "message": "<safe message relayed from OpenClaw>" }
```
Returned when OpenClaw itself emits a `chat` event with `state: "error"`.

### Response 504 — timeout
```json
{ "error": "timeout", "message": "Assistant không phản hồi trong thời gian cho phép." }
```
Fired after `replyTimeoutMs` (FR-010).

**Guarantee**: no response body ever includes the gateway token or device private key (FR-012).

## GET /healthz

Returns backend + gateway connection status.

```json
{ "ok": true, "gateway": "ready", "deviceId": "e2ed0d..." }
```
`gateway` ∈ `connecting | authenticating | ready | closed`. `deviceId` is public (safe to expose; used by operators to approve pairing).
