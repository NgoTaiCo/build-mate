# Docker Setup — BuildMate OpenClaw

Chạy OpenClaw trong Docker, không cần cài Node.js local.

## Quick Start (2 phút)

### Mac/Linux

```bash
cd docker/
make setup
make up
```

### Windows (PowerShell)

```powershell
cd docker
.\setup.bat
.\up.bat
```

**Truy cập:** http://localhost:18789

---

## Setup chi tiết

### 1. Tạo `.env`

```bash
cp .env.example .env
```

Chỉnh sửa 2 dòng bắt buộc:

```env
MODEL_PROVIDER=mimo/mimo-pro    # hoặc openai/gpt-4, ...
API_KEY=your-actual-api-key     # từ opencode.com hoặc OpenAI
```

### 2. Generate `openclaw.json`

```bash
bash generate-config.sh
```

Tạo config từ `.env` variables.

### 3. Start OpenClaw

```bash
docker compose up -d
```

Wait ~10s, kiểm tra:

```bash
make status
```

---

## Commands

### Mac/Linux (using `make`)

| Command | What |
|---------|------|
| `make setup` | Copy .env + generate config |
| `make up` | Start OpenClaw |
| `make down` | Stop OpenClaw |
| `make logs` | Follow logs |
| `make restart` | Restart service |
| `make shell` | SSH vào container |
| `make status` | Check health |
| `make clean` | Stop (keep data) |

### Windows (using batch files)

| Command | What |
|---------|------|
| `.\setup.bat` | Copy .env + generate config |
| `.\up.bat` | Start OpenClaw |
| `.\down.bat` | Stop OpenClaw |
| `.\logs.bat` | Follow logs |
| `.\restart.bat` | Restart service |
| `.\status.bat` | Check health |

**Alternative (any OS):** Use `docker compose` directly:
```bash
docker compose up -d
docker compose logs -f
docker compose restart openclaw-gateway
docker compose down
```

---

## Chỉnh sửa config

Edit `.env` rồi regenerate:

```bash
# Edit .env (thay API_KEY, MODEL_PROVIDER, etc)
vi .env

# Regenerate openclaw.json
bash generate-config.sh

# Restart
make restart
```

Hoặc sửa trực tiếp file trên host (được bind-mount thẳng vào container, không cần SSH):

```bash
vi state/openclaw.json
make restart
```

---

## Data & Volumes

- `./state/` (bind-mount, host directory) → Config (`openclaw.json`) + OpenClaw state, persistent across restarts. Mounted whole as `/root/.openclaw` — không bind-mount `openclaw.json` riêng lẻ, vì lồng một file bind-mount bên trong volume khác sẽ làm openclaw ghi config bị lỗi `EBUSY` (không rename() được đè lên mount point).
- `buildmate_openclaw_workspace` (named volume) → Agent workspace

Xóa dữ liệu:

```bash
rm -rf state/
docker volume rm buildmate_openclaw_workspace
```

---

## Troubleshooting

**Container won't start:**
```bash
make logs
```

**Health check failing:**
- Check `.env`: `MODEL_PROVIDER` + `API_KEY` valid?
- Check `openclaw.json` syntax: `jq . state/openclaw.json`
- Restart: `make restart`

**Logs không xuất hiện:**
```bash
docker compose logs openclaw-gateway
```

**OpenClaw tự sửa `openclaw.json` bị lỗi `EBUSY`:** OpenClaw lưu config bằng cách ghi file tạm rồi `rename()` đè lên `openclaw.json`. Nếu file này bị bind-mount riêng lẻ *bên trong* một volume/thư mục khác đang mount (mount lồng mount), kernel sẽ từ chối `rename()` đè lên mount point đó → `EBUSY`. Cách sửa: mount cả thư mục `state/` (chứa `openclaw.json`) như một khối duy nhất vào `/root/.openclaw`, không mount riêng file `openclaw.json` — xem cấu hình `volumes` hiện tại trong `docker-compose.yml`.

---

## OpenClaw Features

- **WebChat UI**: http://localhost:18789
- **Sessions**: Per-user, auto-reset after idle
- **Memory**: Cross-session recall (QMD backend)
- **Plugins**: Auto-load từ `packages/`
- **Browser automation**: Sẵn sàng cho agent

Xem docs: https://docs.openclaw.ai

---

## Integration with BuildMate

OpenClaw tự động load packages từ `../packages/`:

```yaml
volumes:
  - ${PWD}/packages:/root/.openclaw/packages
```

Sau khi update code trong `packages/`, restart:

```bash
make restart
```

---

## Production notes

Trước deploy:

1. **Change API_KEY** (từ .env, bảo mật)
2. **Set NODE_ENV=production**
3. **Bind tới specific IP** (không 0.0.0.0)
4. **Enable TLS** trong openclaw.json
5. **Backup volumes** regularly

Xem: https://docs.openclaw.ai/gateway/security
