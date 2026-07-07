# Data Model: DOM Build Tools

**Branch**: `004-dom-build-tools` | **Date**: 2026-07-07
**Source**: spec.md Key Entities + research.md §1–§8
**Implementation note**: types dưới đây = TypeScript type definitions. Plugin layer stateless; DOM tools hold no mutable state giữa các invocation.

## Entities Overview

```text
OpenClaw Gateway ──loads── ToolPlugin (@buildmate/openclaw-tools)
                                │
                                ├─ registers ToolDefinition[]
                                │       ├── compile_build     → delegates → @buildmate/compiler
                                │       ├── detect_errors     → delegates → @buildmate/compiler
                                │       ├── repair_build      → delegates → @buildmate/compiler
                                │       ├── search_components → delegates → @buildmate/catalog
                                │       ├── add_to_build      → DOM exec  → phongvu.vn/buildpc or mock-build-pc
                                │       └── read_current_build → DOM exec → phongvu.vn/buildpc or mock-build-pc
                                │
                                ├─ ToolInvocation (input/output envelope)
                                │
                                └─ DOM Tool Layer
                                       ├── PageObject (selectors + wait strategies)
                                       ├── BrowserDriver (Playwright ephemeral context)
                                       ├── DOMParser (parse build state)
                                       └── FallbackDetector (detect login/captcha/timeout)
```

---

## 1. ToolPlugin (extended plugin entry)

Extends entity từ `specs/003-wire-openclaw-plugins/data-model.md` §1.

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | `"buildmate-tools"` | yes | Stable plugin identifier. |
| `name` | `"BuildMate Tools"` | yes | Human-readable plugin name. |
| `register` | `(api: PluginApi) => void` | yes | Đăng ký 6 tools (4 cũ + 2 DOM tools mới). |

**Constraints**:
- Stateless giữa invocations.
- DOM tools không lưu browser context giữa các call (context tạo mới mỗi invocation hoặc do OpenClaw quản lý nếu có native API).
- Không session/memory access trong business logic.

---

## 2. ToolDefinition (DOM tools)

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | `"add_to_build"` \| `"read_current_build"` | yes | Tool name exposed to agent. |
| `description` | `string` | yes | Agent-facing description. Phải nhấn mạnh side-effect (browser automation) và target parameter. |
| `parameters` | `TSchema` (TypeBox) | yes | JSON Schema cho tool parameters. |
| `execute` | `(id: string, params: unknown) => Promise<ToolOutput>` | yes | Server-side in-process handler. |

---

## 3. ExecutionTarget

Enum / union type xác định nơi DOM tool chạy.

```typescript
type ExecutionTarget = "live" | "mock" | "auto";
```

| Value | Meaning |
|---|---|
| `"live"` | Luôn chạy trên `phongvu.vn/buildpc`. |
| `"mock"` | Luôn chạy trên self-hosted mock build-PC page. |
| `"auto"` | Thử `live` trước; nếu fail thì trả về `fallback_suggested: true`, không tự động switch. |

---

## 4. AddToBuildInput

Input parameters cho tool `add_to_build`.

| Field | Type | Required | Description |
|---|---|---|---|
| `sku` | `string` | yes | SKU của linh kiện cần thêm vào build. |
| `target` | `ExecutionTarget` | yes | Mặc định `"auto"`. |

---

## 5. ReadCurrentBuildInput

Input parameters cho tool `read_current_build`.

| Field | Type | Required | Description |
|---|---|---|---|
| `target` | `ExecutionTarget` | yes | Mặc định `"auto"`. |

---

## 6. ComponentSummary

Thông tin linh kiện trả về sau khi add thành công. Là subset của `CatalogComponent` từ `specs/002-mock-catalog-adapter/data-model.md`.

| Field | Type | Required | Description |
|---|---|---|---|
| `sku` | `string` | yes | SKU đã thêm. |
| `name` | `string` | yes | Tên hiển thị. |
| `type` | `ComponentType` | yes | Loại linh kiện. |
| `price` | `number` | no | Giá nếu parse được từ page. |

---

## 7. BuildState

Kết quả của `read_current_build`. Tương tự `Active Build` trong spec nhưng có thêm target và lỗi parse.

| Field | Type | Required | Description |
|---|---|---|---|
| `components` | `ComponentSummary[]` | yes | Danh sách linh kiện hiện có trong build. |
| `total` | `number \| null` | yes | Tổng giá nếu parse được; null nếu không. |
| `empty_categories` | `ComponentType[]` | no | Các category chưa có linh kiện. |
| `warnings` | `string[]` | no | Cảnh báo parse (vd. không đọc được giá). |

---

## 8. AddToBuildOutput

Output envelope của tool `add_to_build`.

| Field | Type | Required | Description |
|---|---|---|---|
| `ok` | `boolean` | yes | true nếu thêm thành công. |
| `target` | `"live" \| "mock"` | yes | Nơi thực sự chạy. |
| `added` | `ComponentSummary` | no | Thông tin linh kiện đã thêm (khi ok=true). |
| `error` | `string` | no | Mô tả lỗi (khi ok=false). |
| `fallback_suggested` | `boolean` | no | true khi target="auto" và live fail, agent cần hỏi user. |

---

## 9. ReadCurrentBuildOutput

Output envelope của tool `read_current_build`.

| Field | Type | Required | Description |
|---|---|---|---|
| `ok` | `boolean` | yes | true nếu đọc thành công. |
| `target` | `"live" \| "mock"` | yes | Nơi thực sự chạy. |
| `build_state` | `BuildState` | no | Trạng thái build (khi ok=true). |
| `error` | `string` | no | Mô tả lỗi (khi ok=false). |
| `fallback_suggested` | `boolean` | no | true khi target="auto" và live fail. |

---

## 10. BrowserDriver

Đối tượng quản lý Playwright browser context cho mỗi invocation. Không phải entity persist.

| Field | Type | Description |
|---|---|---|
| `launch` | `() => Promise<BrowserContext>` | Khởi tạo headless context. |
| `navigate` | `(url: string) => Promise<Page>` | Mở URL trong tab mới. |
| `close` | `() => Promise<void>` | Đóng context sau khi tool hoàn thành. |

**Constraints**:
- Mỗi invocation tạo context riêng hoặc tái sử dụng context từ OpenClaw nếu SDK hỗ trợ.
- Không giữ state giữa các tool call.
- Timeout mặc định 30 giây cho navigation và critical wait.

---

## 11. PageObject

Tập hợp selectors và wait strategies dùng chung cho cả live site và mock page.

| Field | Type | Description |
|---|---|---|
| `buildPageUrl` | `{ live: string; mock: string }` | URL của 2 targets. |
| `categoryRow` | `(label: string) => string` | Selector tìm category row theo text (VGA/CPU/...). |
| `categoryChooseButton` | `string` | Nút "Chọn" trong category row. |
| `modal` | `string` | Selector chờ modal mở. |
| `productCard` | `(sku: string) => string` | Selector tìm product card theo SKU. |
| `productChooseButton` | `string` | Nút "Chọn" trong product card. |
| `buildListContainer` | `string` | Container chứa build list đã chọn. |
| `buildListItem` | `string` | Mỗi item trong build list. |

**Quy tắc selectors**:
- Chỉ dùng text/aria/role/`data-*` selectors.
- Không hardcode emotion class hoặc dynamic ID.
- Có thể override bằng selector manifest JSON nếu site đổi UI.

---

## 12. DOMParser

Pure helper parse HTML/Page thành `BuildState`.

| Function | Input | Output | Description |
|---|---|---|---|
| `parseBuildState(page)` | Playwright Page | `BuildState` | Trích xuất components, total, empty categories. |
| `parsePrice(text)` | `string` | `number \| null` | Parse giá từ text (loại bỏ dấu chấm, chữ). |
| `findCategoryType(label)` | `string` | `ComponentType \| null` | Map Vietnamese/English label → component type. |

---

## 13. FallbackDetector

Pure helper (hoặc lightweight async checker) xác định tại sao live site không drive được.

| Field / Function | Type | Description |
|---|---|---|
| `detect(page, elapsedMs)` | `(page, number) => FallbackReason \| null` | Trả về lý do nếu phát hiện login/captcha/timeout/selector missing. |

## 13.1 FallbackReason

```typescript
type FallbackReason =
  | { code: "TIMEOUT"; detail: string }
  | { code: "LOGIN_WALL"; detail: string }
  | { code: "ANTIBOT"; detail: string }
  | { code: "SELECTOR_BROKEN"; detail: string }
  | { code: "UNREACHABLE"; detail: string };
```

---

## 14. MockBuildPage

Self-hosted mock build-PC page.

| Field | Type | Description |
|---|---|---|
| `server` | `http.Server` | Minimal HTTP server phục vụ static files + API. |
| `url` | `string` | URL local (vd. `http://127.0.0.1:3001`). |
| `catalog` | `CatalogComponent[]` | Full catalog replica loaded từ `@buildmate/catalog` hoặc `catalog.json`. |
| `reset` | `() => void` | Reset build state về rỗng (dùng trong test). |

**Routes**:
- `GET /` — trang build PC.
- `GET /api/catalog` — trả catalog JSON.
- `POST /api/reset` — reset build state.

---

## 15. Invariants

- **Stateless**: plugin và DOM tools không giữ mutable state giữa invocations.
- **Target explicit**: execution target luôn được truyền qua parameter; không lưu trong session/plugin.
- **No Compiler logic leakage**: DOM tools không kiểm tra compatibility; nếu cần validate, agent gọi `compile_build`/`detect_errors` riêng.
- **No checkout/payment/multi-tab**: DOM tools chỉ tương tác với build PC page; không click nút thanh toán hoặc mở tab mới.
- **Semantic selectors only**: không hardcode emotion class / dynamic ID.

## 16. Out-of-scope data

- Session/memory state — owned by OpenClaw (Constitution Principle I).
- Compiler compatibility data — owned by `@buildmate/compiler` (001).
- Catalog data schema — owned by `@buildmate/catalog` (002); DOM tools chỉ consume.
- Chrome Extension overlay — deferred.
- Checkout/payment flow data — out of scope.
