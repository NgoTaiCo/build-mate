# Research: DOM Build Tools

**Branch**: `004-dom-build-tools` | **Date**: 2026-07-07
**Phase**: 0 — resolve technical unknowns before design
**Source**: `docs/openclaw-reference.md` §8, `docs/extension-phongvu-integration.md`, `specs/003-wire-openclaw-plugins/contracts/tool-plugin-contracts.md`, `specs/002-mock-catalog-adapter/spec.md`

## Research Tasks

| # | Unknown / Choice | Resolved in § |
|---|---|---|
| R1 | Browser automation library / SDK | §1 |
| R2 | Tool parameter & target design (live / mock / auto) | §2 |
| R3 | Side-effect tool testing strategy | §3 |
| R4 | Mock build-PC page technology | §4 |
| R5 | Real-site undrivable detection & fallback flow | §5 |
| R6 | Build state parsing from phongvu DOM | §6 |
| R7 | Add-by-SKU flow on phongvu.vn/buildpc | §7 |
| R8 | Keeping DOM tools separated from Compiler trust layer | §8 |

---

## §1. Browser Automation Library / SDK

**Decision**: Sử dụng **Playwright** trực tiếp trong tool implementation. Ưu tiên OpenClaw native browser automation API nếu SDK expose programmatic API; nếu không thì fallback về Playwright.

**Rationale**:
- `docs/openclaw-reference.md` §8 ghi OpenClaw có built-in tool "browser automation" và skill `browser-automation` từ browser plugin, nhưng không mô tả programmatic API cho tool plugin gọi ngầm.
- Playwright là industry standard cho server-side browser automation: headless Chromium, stable selectors, auto-wait, screenshots, network interception. Phù hợp để drive React/Next.js page và mock page.
- Puppeteer cũng khả thi nhưng Playwright có selector engine mạnh hơn (text, role, label), auto-wait tốt hơn, và hỗ trợ nhiều browser — phù hợp hackathon ít debugging.

**Implementation note**:
- Mỗi tool invocation tự quản lý browser context mới hoặc tái sử dụng ephemeral context — plugin vẫn stateless giữa các call.
- Playwright là runtime dependency của `@buildmate/openclaw-tools`; không ảnh hưởng `@buildmate/compiler` / `@buildmate/catalog`.

**Alternatives considered**:
- OpenClaw native browser automation API — preferred nếu tồn tại, nhưng tài liệu hiện tại chỉ mô tả dưới dạng agent tool, không rõ SDK surface cho plugin internal.
- Puppeteer — rejected: Playwright ổn định hơn cho React dynamic content và auto-wait.
- Selenium — rejected: nặng, chậm, không phù hợp hackathon.

---

## §2. Tool Parameter & Target Design

**Decision**: Mỗi DOM tool nhận parameter `target` với 3 giá trị: `"live"`, `"mock"`, `"auto"`. `"auto"` thử live trước, nếu fail thì trả về `fallback_suggested: true` để agent hỏi user confirm, sau đó agent gọi lại với `"mock"`.

**Rationale**:
- Constitution Principle I: plugin stateless, không lưu trạng thái "đang ở mode nào" trong session. Target phải được truyền rõ ràng mỗi lần gọi.
- FR-010 yêu cầu pause và hỏi user trước khi switch sang mock. OpenClaw tool `execute` không thể block chờ user mid-call; cách tự nhiên là tool trả về fallback suggestion và agent xử lý confirm qua conversation turn.
- `target: "auto"` giữ UX mượt cho happy path; `"mock"` cho explicit fallback; `"live"` cho explicit real-site test.

**Parameter schemas**:
- `add_to_build`: `{ sku: string, target: "live" | "mock" | "auto" }`
- `read_current_build`: `{ target: "live" | "mock" | "auto" }`

**Output shape**:
- `add_to_build`: `{ ok: boolean, target: "live" | "mock", added?: ComponentSummary, error?: string, fallback_suggested?: boolean }`
- `read_current_build`: `{ ok: boolean, target: "live" | "mock", build_state?: BuildState, error?: string, fallback_suggested?: boolean }`

**Alternatives considered**:
- Tool tự động fallback không cần confirm — rejected: vi phạm FR-010.
- Lưu `preferred_target` trong OpenClaw session từ plugin — rejected: vi phạm stateless principle; nếu cần persistence thì do agent/system prompt xử lý.
- Hai tool riêng (`add_to_build_live`, `add_to_build_mock`) — rejected: làm phình tool manifest, agent dễ nhầm.

---

## §3. Side-Effect Tool Testing Strategy

**Decision**: Tách logic thành 2 lớp:
1. **Pure helpers** (selector resolution, SKU matcher, DOM parser, fallback detector) — unit test với `node:test`.
2. **DOM tool integration** — test bằng cách chạy tool chống mock build-PC page thật (khởi động server trong test setup). Không unit-test phần Playwright click vì có side effect.

**Rationale**:
- Constitution Quality Gate yêu cầu code deterministic có unit test. DOM tools không deterministic (phụ thuộc network/page state), nên không thể áp dụng cùng gate.
- Tách pure helpers ra để vẫn có thể đảm bảo `npm test` xanh với coverage tốt.
- Mock page integration test cho phép verify end-to-end flow mà không phụ thuộc phongvu.vn uptime/anti-bot.

**Test files dự kiến**:
- `dom-helpers.test.ts` — pure helpers
- `fallback-detector.test.ts` — detect login/captcha/timeout (với fixtures HTML)
- `add-to-build-mock.test.ts` — integration
- `read-current-build-mock.test.ts` — integration

**Alternatives considered**:
- Mock Playwright hoàn toàn — rejected: không đủ tin cậy để verify selector/wait strategy thật.
- Chỉ test trên phongvu.vn live — rejected: hackathon không ổn định, anti-bot có thể làm test flake.

---

## §4. Mock Build-PC Page Technology

**Decision**: Self-hosted mock page là static HTML/JS served bởi minimal Node.js HTTP server (dùng `node:http` hoặc Express). Page mirror layout phongvu.vn/buildpc với category rows, "Chọn" buttons, modal async load, và build list.

**Rationale**:
- Phải đủ giống phongvu để cùng automation code có thể drive cả hai (`page-object.ts` dùng chung selectors semantic).
- Phải đơn giản để implement trong 1-2 giờ hackathon.
- Static HTML/JS không cần build step phức tạp; catalog data nhúng qua `catalog.json` hoặc fetch từ server `/api/catalog`.
- Express dễ thêm API nhỏ để reset build state giữa các integration test.

**Mock page capabilities**:
- Category rows: CPU, Mainboard, RAM, VGA, SSD, PSU, Case, Cooler.
- Click "Chọn" → mở modal → load product cards async (~200ms) để giả lập React async behavior.
- Add by SKU: modal có thể filter/search hoặc product card chứa `data-sku`; tool tìm `button[data-sku="..."]` hoặc text match.
- Build list: hiển thị selected components; `read_current_build` parse từ DOM.
- Reset endpoint `/api/reset` cho test isolation.

**Alternatives considered**:
- Next.js app giống phongvu — rejected: quá nặng, build chậm, không cần thiết.
- Vite dev server — rejected: cần build step, phụ thuộc nhiều hơn Express.
- Pure static files mở bằng file:// — rejected: CORS/async fetch không ổn định; cần HTTP server.

---

## §5. Real-Site Undrivable Detection & Fallback Flow

**Decision**: Detector đánh dấu live site undrivable khi gặp một trong các điều kiện:
1. Page unreachable / network error sau 3 retry.
2. Navigation redirect đến login page (URL chứa `/login`, `/dang-nhap`, hoặc DOM có form đăng nhập).
3. Timeout chờ critical element > 30 giây (configurable).
4. Anti-bot / captcha element xuất hiện (recaptcha, hcaptcha, cloudflare challenge).
5. Critical selector không tìm thấy sau retry (UI đổi).

Khi `target: "auto"` và detector kích hoạt, tool trả về:
```json
{ "ok": false, "target": "live", "error": "Live site unreachable: login wall detected", "fallback_suggested": true }
```
Agent đọc `fallback_suggested`, hỏi user. Nếu user đồng ý, agent gọi lại với `target: "mock"`.

**Rationale**:
- Phongvu.vn/buildpc là Next.js + React, có thể yêu cầu login hoặc chặn bot. Không thể đảm bảo automation 100%.
- Detector tập trung vào các dấu hiệu rõ ràng, không dùng heuristic phức tạp.
- Trả về suggestion thay vì tự động switch giữ đúng FR-010 và giúp agent explain cho user.

**Alternatives considered**:
- Tự động retry vô hạn — rejected: vi phạm SC-001 (30s) và gây risk bị block.
- Tự động fallback không confirm — rejected: vi phạm FR-010.
- Nhận diện login bằng URL pattern đơn giản — accepted nhưng bổ sung thêm DOM check.

---

## §6. Build State Parsing from phongvu DOM

**Decision**: Parser đọc build state từ container chứa danh sách linh kiện đã chọn. Sử dụng selectors dựa trên text/aria/role (theo `docs/extension-phongvu-integration.md` §3), không hardcode emotion class.

**Parsing strategy**:
- Tìm container build list: `[class*="teko-col-8"]` có chứa row với text category (CPU, VGA...) và product info.
- Với mỗi row đã có sản phẩm, extract: category label, product name, price (nếu hiển thị), SKU (nếu có `data-sku` hoặc từ product link).
- Nếu row chưa có sản phẩm (chỉ có nút "Chọn"), đánh dấu category empty.
- Trả về `BuildState` với `components[]` và `total` (nếu parse được; nếu không thì null).

**Rationale**:
- `docs/extension-phongvu-integration.md` §2 mô tả DOM có category rows và modal. Extension doc đã xác định stable selectors.
- Text/aria/role selectors ít brittle hơn class emotion.
- Parser là pure function nhận HTML/DOM fixture → dễ unit test.

**Alternatives considered**:
- Dùng extension content script để parse — rejected: Extension out-of-scope, feature yêu cầu server-side.
- Dùng OCR/screenshot — rejected: overkill, không deterministic.

---

## §7. Add-by-SKU Flow on phongvu.vn/buildpc

**Decision**: Flow `add_to_build(sku)`:
1. Resolve component type và SKU từ `@buildmate/catalog` (hoặc từ SKU pattern nếu catalog chưa sẵn).
2. Navigate đến `phongvu.vn/buildpc`.
3. Tìm category row tương ứng (CPU/Mainboard/...).
4. Click nút "Chọn" của row.
5. Wait for modal và product list load.
6. Tìm product card chứa SKU (qua `data-sku`, product link, hoặc text name nếu SKU không expose).
7. Click nút "Chọn" trên product card.
8. Wait for build list update.
9. Verify SKU xuất hiện trong build list (qua `read_current_build` parse).
10. Return result.

**SKU matching strategy**:
- Ưu tiên `data-sku` attribute trên product card.
- Nếu không có, match theo product name từ catalog.
- Nếu vẫn không tìm thấy, return error `SKU_NOT_FOUND`.

**Rationale**:
- Phongvu.vn/buildpc modal load product async; cần wait strategy chắc chắn.
- SKU là input chính xác nhất; nếu site không expose SKU trong DOM thì fallback theo name.
- Verify sau add đảm bảo insertion thành công thay vì chỉ click xong.

**Alternatives considered**:
- Search box trong modal — rejected: không chắc chắn modal có search; filter facets (AMD, 16GB...) dùng `aria-label` có thể hỗ trợ nhưng phức tạp hơn.
- Direct URL add — rejected: phongvu.vn/buildpc không có documented URL param để thêm SKU.

---

## §8. Keeping DOM Tools Separated from Compiler Trust Layer

**Decision**: DOM tools chỉ thực hiện 2 việc: (1) drive browser để insert/read build, (2) format result. Không đưa compatibility logic vào DOM tools. Nếu cần validate trước khi add, agent gọi `compile_build` / `detect_errors` riêng.

**Rationale**:
- Constitution Principle II: Compiler là deterministic trust layer. DOM tools tương tác với external website, inherently non-deterministic. Không được để logic non-deterministic làm nhiễu trust layer.
- Tách rõ trách nhiệm: Compiler quyết định build có hợp lệ không; DOM tool chỉ thực thi insertion đã được agent yêu cầu.
- FR-006 chỉ yêu cầu confirm successful insertion hoặc report failure reason — không yêu cầu DOM tool check compatibility.

**What DOM tools MUST NOT do**:
- Gọi LLM để đoán compatibility.
- Sửa build input để "hợp lệ".
- Bypass Compiler trong repair flow.

**What DOM tools MAY do**:
- Gọi `@buildmate/catalog` để resolve SKU → type/name (read-only, deterministic).
- Gọi `@buildmate/compiler` nếu feature sau này yêu cầu pre-add validation (hiện tại không bắt buộc).

**Alternatives considered**:
- Nhúng validation trực tiếp trong `add_to_build` — rejected: vi phạm separation of concerns, làm tool phức tạp, và có thể khiến LLM dựa vào DOM tool thay vì Compiler.

---

## Phase 0 Summary

All 8 research tasks resolved. No remaining NEEDS CLARIFICATION. Decisions feed into:
- `data-model.md`: DOM tool entities, BuildState, ExecutionTarget, BrowserContext.
- `contracts/dom-tool-contracts.md`: tool schemas, output envelopes, error codes, selector contracts.
- `quickstart.md`: install Playwright browsers, start mock server, run integration tests, verify via WebChat.
- `plan.md`: technical context + constitution check updated.
