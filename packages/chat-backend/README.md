# @buildmate/chat-backend

Backend relay stateless: frontend gửi `POST /chat { message, sessionId }`, backend
chuyển tiếp tới OpenClaw gateway qua WebSocket (protocol 4, V3 Ed25519 device auth)
và trả về câu trả lời cuối của assistant.

Backend chỉ giữ transport connection và một bảng correlation ngắn hạn giữa
request và reply. Không có session store, không lưu history, không idempotency
layer — OpenClaw sở hữu toàn bộ session và memory (Constitution Principle I).

## Kiến trúc

```
frontend --POST /chat--> chat-backend --WS chat.send--> OpenClaw gateway
frontend <--reply------- chat-backend <--WS chat event (state:final)--
```

- `src/device-auth.ts` — module thuần (pure): từ seed cố định derive keypair
  Ed25519, `deviceId = hex(SHA-256(rawPublicKey))`, build + sign V3 payload.
- `src/gateway-client.ts` — WebSocket client: handshake, `chat.send`, correlate
  reply theo `runId`, reconnect transport-only, timeout mỗi request.
- `src/http-server.ts` — `node:http` server: `POST /chat`, `GET /healthz`, CORS.
- `src/config.ts` — load và validate env; không log secret.
- `src/index.ts` — entry point.

## Environment variables

| Biến | Bắt buộc | Mặc định | Ghi chú |
|------|----------|----------|---------|
| `OPENCLAW_GATEWAY_URL` | không | `ws://localhost:18790` | URL WebSocket của gateway. |
| `OPENCLAW_GATEWAY_TOKEN` | có | — | Shared token của gateway. **Secret, không log.** |
| `OPENCLAW_DEVICE_SEED` | có | — | Seed Ed25519 cố định, base64url 32 byte. **Secret, không log.** |
| `PORT` | không | `8790` | Port HTTP cho frontend. |
| `REPLY_TIMEOUT_MS` | không | `60000` | Thời gian chờ tối đa một reply. |
| `DEFAULT_AGENT_ID` | không | `main` | Agent mặc định khi request không nêu `agentId`. |

## Tạo device seed (một lần duy nhất)

Seed cố định là điểm mấu chốt: cùng một seed luôn cho ra cùng một `deviceId`,
nên device chỉ cần approve trên gateway đúng một lần và sống qua mọi lần restart.

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Lưu giá trị này vào secret config của deployment. **Không commit vào repo.**

## Approve-once flow

1. Chạy backend lần đầu -> gateway trả `PAIRING_REQUIRED`; backend log ra
   `deviceId` và tự retry.
2. Operator approve một lần:
   ```bash
   docker exec openclaw-gateway openclaw devices list --json
   docker exec openclaw-gateway openclaw devices approve <requestId> --token <token>
   ```
3. Backend tự đạt trạng thái `ready` mà không cần restart. Approval này vĩnh viễn
   cho seed đó — restart bao nhiêu lần cũng không phát sinh pairing mới.

## Chạy

```bash
# dev (tsx, không cần build)
npm run -w @buildmate/chat-backend dev

# build + chạy dist
npm run -w @buildmate/chat-backend build
node packages/chat-backend/dist/index.js
```

## Chạy bằng Docker Compose

Service `chat-backend` đã được khai báo trong [docker/docker-compose.yml](../../docker/docker-compose.yml),
khởi động cùng gateway khi `docker compose up`.

```bash
cd docker
docker compose up -d          # start cả openclaw-gateway và chat-backend
```

Cấu hình qua `docker/.env` (xem `docker/.env.example`):
- `GATEWAY_TOKEN` — phải khớp token trong `openclaw.json`.
- `OPENCLAW_DEVICE_SEED` — seed cố định (tạo 1 lần, xem bên dưới).
- `CHAT_BACKEND_PORT` — port host, mặc định `8790`.

Trong compose, backend tự trỏ tới gateway qua `ws://openclaw-gateway:18790`
(service name trên compose network). Lần đầu vẫn cần approve device đúng một lần:

```bash
docker exec openclaw-gateway openclaw devices list --json
docker exec openclaw-gateway openclaw devices approve <requestId> --token "$GATEWAY_TOKEN"
```

Approval nằm trong named volume `openclaw-config` nên sống qua mọi lần
`docker compose up`/recreate — không phải approve lại.

```bash
curl -s http://localhost:8790/healthz | jq          # kiểm tra ready
docker logs buildmate-chat-backend                  # xem log
```

## API

### `POST /chat`

Request:
```json
{ "message": "Tư vấn giúp tôi build PC 20 triệu", "sessionId": "user-42", "agentId": "main" }
```
- `message` (string, bắt buộc, non-empty sau trim)
- `sessionId` (string, bắt buộc, non-empty) — giữ ổn định để tiếp tục hội thoại
- `agentId` (string, tùy chọn, mặc định `main`)

Response 200:
```json
{ "sessionId": "user-42", "reply": "Với 20 triệu, tôi đề xuất ...", "runId": "b0e1..." }
```

Error codes: `validation_error` (400), `pairing_required` (425),
`gateway_unavailable` (502), `auth_failed` (502), `gateway_error` (502),
`timeout` (504). Response không bao giờ chứa token hay private key.

### `GET /healthz`

```json
{ "ok": true, "gateway": "ready", "deviceId": "e2ed0d..." }
```
`gateway` ∈ `connecting | authenticating | ready | pairing_required | closed`.
`deviceId` là public — operator dùng để approve pairing.

## Session mapping

`sessionId` được map thành session key của OpenClaw bằng một hàm thuần:
- Nếu `sessionId` chứa `:` -> forward nguyên văn (đã là full key).
- Ngược lại -> `agent:${agentId}:${sessionId}`.

Backend không lưu bảng map. Gửi lại cùng `sessionId` -> OpenClaw reload đúng
history -> hội thoại tiếp tục. Frontend chịu trách nhiệm giữ `sessionId` ổn định.

## Test

```bash
npm test -w @buildmate/chat-backend        # unit test (không cần gateway)
npm run -w @buildmate/chat-backend typecheck
```

Unit test bao phủ: V3 payload string, derive `deviceId` từ seed cố định,
base64url public key, và logic correlate reply (`runId` -> pending request).
Validation end-to-end xem `specs/009-openclaw-chat-backend/quickstart.md`.
