# Research Notes: Wire WebChat end-to-end demo

**Feature**: 005-wire-webchat-e2e-demo  
**Date**: 2026-07-07  
**Purpose**: Resolve unknowns from Technical Context and document technology decisions.

## Decision 1 — OpenClaw tool plugin shape (server-side in-process)

**Decision**: Expose Compiler + Catalog + DOM tools qua OpenClaw **tool plugin** (`openclaw/plugin-sdk`), không phải HTTP microservice riêng.

**Rationale**:
- OpenClaw gateway gọi tool plugin **in-process**; giảm latency và networking complexity cho demo 1 ngày.
- `api.registerTool(...)` hỗ trợ TypeBox schemas, phù hợp kiểm soát input/output.
- Tool plugin có thể install bằng `openclaw plugins install --link` và inspect runtime qua `openclaw plugins inspect <id> --runtime --json`.

**Alternatives considered**:
- HTTP service riêng cho Compiler/Catalog: thêm Backend Gateway, vi phạm nguyên tắc I (OpenClaw owns session/memory) và tăng rủi ro kỹ thuật.
- LangChain/LangGraph orchestrator: vi phạm nguyên tắc III (model là provider config, không layer orchestrator riêng).

## Decision 2 — Test runner: Node built-in test runner + tsx

**Decision**: Dùng Node.js built-in test runner (`node --test`) với `tsx` để chạy TypeScript test, không dùng Vitest/Jest.

**Rationale**:
- Compiler package yêu cầu **zero runtime dependency**; dùng test runner built-in tránh thêm dependency.
- `tsx` chỉ là dev dependency, đã được ghi nhận trong AGENTS.md.
- Đủ cho ~15 unit test của Compiler và contract test nhỏ.

**Alternatives considered**:
- Vitest: phổ biến nhưng thêm runtime dependency và dev config phức tạp hơn.
- Jest: nặng hơn, cần transform config; không phù hợp zero-dependency goal.

## Decision 3 — DOM execution: Playwright server-side + self-hosted mock page fallback

**Decision**: `add_to_build` / `read_current_build` dùng Playwright server-side để drive trang `phongvu.vn/buildpc`; nếu probe fail thì fallback về mock trang build PC do team tự host.

**Rationale**:
- OpenClaw có browser automation built-in, nhưng drive trang React có login của Phong Vu cần verify (ADR-0003 §4).
- Mock page fallback đảm bảo demo vẫn chứng minh compiler + flow ngay cả khi không access được site thật.
- Playwright phù hợp server-side automation và đã được ghi nhận trong active technologies.

**Alternatives considered**:
- Chrome Extension remote-tool bridge: stretch, cần custom channel plugin > 1 ngày (ADR-0003 §2.3).
- Puppeteer: tương đương Playwright nhưng OpenClaw ecosystem gợi ý Playwright cho server-side automation.

## Decision 4 — Error codes cho S3 repair

**Decision**: Demo tập trung vào **E001 SOCKET_MISMATCH** và **E002 POWER_INSUFFICIENT**. E002 RAM_GEN_MISMATCH có thể được bổ sung sau nếu catalog hỗ trợ nhiều gen RAM.

**Rationale**:
- Feature spec yêu cầu E001/E002; ví dụ cấu hình lỗi trong ADR-0003 (i5-12400F + B650 + DDR4) thực chất là socket mismatch (E001) và có thể kết hợp RAM gen mismatch.
- POWER_INSUFFICIENT là lỗi dễ tạo scenario demo (PSU quá yếu so với GPU/CPU) và minh họa rõ giá trị repair.

**Alternatives considered**:
- E002 = RAM_GEN_MISMATCH theo constitution: có thể dùng nhưng scenario demo dễ bị rối vì cùng lúc nhiều lỗi; giữ E002 POWER_INSUFFICIENT cho rõ ràng.
- Thêm nhiều error codes khác: out of scope cho 1 ngày; có thể mở rộng sau.

## Decision 5 — Model provider

**Decision**: Dùng **mimo pro** (opencode Go plan) qua cấu hình OpenClaw `agents.defaults.model`; chuẩn bị provider dự phòng (OpenAI/Gemini/Ollama local) trong `openclaw.json`.

**Rationale**:
- Constitution xác định mimo pro là provider config trong `~/.openclaw/openclaw.json`.
- OpenClaw hỗ trợ 35+ providers, dễ fallback nếu mimo pro fail.
- LLM chỉ dùng cho intent parsing / synthesis; mọi compatibility check đều do Compiler deterministic.

**Alternatives considered**:
- Gọi model trực tiếp từ code tool: vi phạm nguyên tắc III và làm tool plugin phụ thuộc model runtime.

## Decision 6 — MockCatalog: JSON in-memory, no database

**Decision**: Catalog lưu ~50 linh kiện dạng JSON trong package `@buildmate/catalog`, load vào memory lúc runtime; không dùng DB.

**Rationale**:
- MVP hackathon không cần persist catalog; mock data đủ field (price, stock_status, promo, specs).
- Pure function search dễ unit test và không phụ thuộc I/O.
- Sau hackathon có thể thay adapter để gọi PhongVu API thật.

**Alternatives considered**:
- SQLite/PostgreSQL: thêm dependency và setup không cần thiết cho 1 ngày.
- Gọi PhongVu API trực tiếp: rủi ro rate limit / auth / network; mock giúp demo ổn định.
