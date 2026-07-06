# Maintenance — Maintain thế nào

## 1. Selector refresh (khi phongvu đổi UI)
- Triệu chứng: Extension/tool không tìm được category row / product card / nút "Chọn".
- Xử lý:
  1. Mở `phongvu.vn/buildpc` → DevTools inspect DOM mới.
  2. Chạy discovery (xem `docs/extension-phongvu-integration.md` §7.5) → cập nhật **selector manifest** (JSON, không sửa code).
  3. Chỉ hardcode text/aria/role (nút "Chọn", `[role=dialog"]`, label "VGA"). Tránh emotion class + dynamic ID + nth-of-type.
- Tần suất dự kiến: mỗi lần Phong Vu rebuild UI (emotion hash đổi).

## 2. OpenClaw upgrade
- Pin version trong `openclaw.json` / `package.json`.
- Đọc release notes trước khi nâng — chú ý session schema, tool plugin API, skill format.
- Test sau upgrade: `openclaw gateway` start, WebChat chat "hello", 1 tool call chạy, session resume sau restart.
- Session store format đổi → xem `docs/openclaw-reference.md` §2 để migrate.

## 3. Compiler (trust layer)
- **Unit test phải luôn xanh** (`npm test` gate trước demo/deploy).
- Thêm rule → thêm test fixture (valid + invalid + expected error code).
- Tách package riêng, không phụ thuộc OpenClaw runtime → test độc lập, nhanh.
- Review rule định kỳ: có edge case nào rule sai không (vd TPU mới, socket mới).

## 4. Session / memory hygiene
- Monitor `~/.openclaw/agents/<id>/sessions/` size — `session.maintenance.pruneAfter` + `maxEntries` đã có default.
- QMD memory: kiểm tra recall chất lượng định kỳ (khách quay lại có nhớ ngữ cảnh không).
- Idle/daily reset: tune `session.reset.idleMinutes` theo traffic.

## 5. Monitoring / observability (production)
| Metric | Cách đo | Alert khi |
|---|---|---|
| Gateway uptime | health endpoint `/health` | down > 1 phút |
| Model cost | token usage per session | vượt budget per session |
| Tool call latency | log round-trip | p95 > 5s |
| Tool error rate | log tool_result error | > 5% |
| Session store size | `du` sessions dir | > 500MB |

## 6. Demo hygiene
- Luôn có **video backup** full journey trước demo (mạng sự kiện yếu).
- Mock page fallback sẵn sàng (browser automation fail → mock).
- `npm test` xanh + `openclaw gateway` chạy + chat "hello" reply = pre-flight check.

## 7. Incident response (nhanh)
- OpenClaw crash → daemon auto-restart; session durable → resume (xem ADR-0001 §4.2).
- Model down → fallback model (`agents.defaults.models` nhiều entry).
- Tool fail → agent trả graceful "agent đang bận" + retry backoff.
