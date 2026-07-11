# Chrome Extension trên phongvu.vn/buildpc — Hướng dẫn kỹ thuật

> Tham chiếu kỹ thuật cho việc xây extension Chrome thao tác trên trang `phongvu.vn/buildpc` (đọc cấu hình build, tự thêm linh kiện). Mục đích: rút ngắn công việc khi team build extension trong tương lai.

Bridge production giữa MCP, BE và extension được mô tả tại
[`docs/dom-executor-bridge-contract.md`](./dom-executor-bridge-contract.md).

## 1. Kiến trúc MV3 (recap)

| Thành phần | Vai trò |
|---|---|
| `manifest.json` | Khai báo permissions, host_permissions, content_scripts, service worker |
| Content script | Chạy trong page, đọc DOM, inject UI overlay, bắn SyntheticEvent |
| Background service worker | WebSocket client (nếu cần backend), `chrome.alarms` keep-alive |
| `host_permissions` + `matches` | Cấp quyền inject vào domain |

### Bẫy `matches` (quan trọng)
Trang thật là `https://phongvu.vn/buildpc` (KHÔNG có `www`). Phải match cả non-www:
```json
"matches": ["https://phongvu.vn/buildpc*", "https://www.phongvu.vn/buildpc*"],
"host_permissions": ["https://phongvu.vn/*", "https://www.phongvu.vn/*"]
```
Thiếu non-www → content script không inject → overlay không xuất hiện.

## 2. Cấu trúc DOM phongvu.vn/buildpc

phongvu.vn = **Next.js + emotion (styled-components) + Teko grid**.

```
#__next
└── div[class*="teko-col-8"]   ← CÓ NHIỀU CÁI
    ├── container 0: "Cấu hình 1/2/3" (tab profile, KHÔNG phải category list)
    └── container N: category list (CPU/Mainboard/RAM/VGA/SSD/PSU/...)
          └── div (mỗi category = 1 row)
                ├── label text: "VGA" / "Card màn hình"  (STABLE)
                └── <button aria-label="Chọn">  (STABLE)
```

Click nút "Chọn" của category → mở **modal**:
```
[role=dialog]  HOẶC  div.css-fa3kpy (emotion, brittle)  HOẶC  #teko-modal-<random> (dynamic)
└── product list load BẤT ĐỒNG BỘ — ban đầu rỗng, ~1-2s sau mới có product cards
    └── <button> text "Chọn"  (nút chọn product — STABLE)
    └── filter facets: [aria-label="AMD"], [aria-label="16GB"], [aria-label="GDDR6"]…
```

## 3. Selector: stable vs brittle

| Loại | Ví dụ | Dùng? |
|---|---|---|
| **STABLE** text/aria/role | `button[aria-label="Chọn"]`, `[role="dialog"]`, `[aria-label="AMD"]`, leaf text "VGA" | ✅ |
| BRITTLE emotion class | `css-fa3kpy`, `css-1k3jniv`, `css-1q7lj4i` | ❌ đổi mỗi build |
| BRITTLE dynamic ID | `teko-modal-mr8t8pckxo…` | ❌ đổi mỗi session |
| BRITTLE positional | `div:nth-of-type(N)` | ❌ vỡ khi đổi thứ tự |

**Quy tắc: chỉ hardcode text/aria/role. Tránh tuyệt đối emotion class + dynamic ID + nth-of-type.**

## 4. Flow tương tác (auto-add 1 product)

```
1. findVgaRow(doc)           — quét TẤT CẢ [class*="teko-col-8"], tìm child text "VGA"/"Card"
2. click nút "Chọn" của row  — mở modal
3. waitFor(modal)            — [role=dialog] hoặc [class*="css-fa3kpy"] hoặc [id^="teko-modal-"]
4. (tuỳ chọn) click filter   — [aria-label*="AMD"]
5. KEY: waitFor(product)     — đợi PRODUCT xuất hiện, KHÔNG phải modal shell (async load!)
6. click product "Chọn"      — SP vào build list
```

### 2 bẫy cần biết
- **Modal mở rỗng** (product list load bất đồng bộ). Nếu chỉ `waitFor(modal)` rồi tìm product ngay → trả null → phải thử lại. **Fix:** `waitFor(() => findFirstProduct(modal), 6000)`.
- **Lấy nhầm container** `teko-col-8` đầu tiên = config tabs. **Fix:** quét tất cả container, chọn cái có child VGA.

## 5. SyntheticEvent cho React

phongvu dùng React 17+. React gắn event listener ở **root container**, không phải từng element. Bắn **native bubbling `MouseEvent("click")`** (+ chuỗi pointer/mouse down/up) là ĐỦ kích hoạt `onClick` — không cần gọi React internals.

```js
function syntheticClick(el) {
  const init = { bubbles: true, cancelable: true, composed: true, button: 0, view: window };
  const fire = (t) => {
    const Ctor = t.indexOf("pointer")===0 ? PointerEvent : t.indexOf("mouse")===0 ? MouseEvent : Event;
    return el.dispatchEvent(new Ctor(t, init));
  };
  fire("pointerdown"); fire("mousedown"); fire("pointerup"); fire("mouseup");
  return fire("click");
}
```

## 6. Keep-alive MV3 service worker

MV3 kill service worker sau ~30s idle. Giữ WS sống:
- **Server ping mỗi 10s** (mỗi inbound WS message reset idle timer) — primary.
- **`chrome.alarms`** (period 0.5–1 min) — backup, gọi `connectWS()` reconnect.

```js
chrome.alarms.create("keepalive", { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === "keepalive" && (!ws || ws.readyState > 1)) connectWS();
});
```

## 7. Code patterns

### 7.1. `findVgaRow` — tìm category row bằng text (robust)
```js
function text(el){return(el&&el.textContent?el.textContent:"").replace(/\s+/g," ").trim();}
function findVgaRow(doc){
  const cols = doc.querySelectorAll('[class*="teko-col-8"]');
  let best=null;
  for(const c of cols) for(const k of c.children){
    const t=text(k);
    if(/VGA|Card/i.test(t)&&t.length<120)
      if(!best||t.length<best.text.length) best={row:k,text:t};
  }
  if(best) return best;
  for(const el of doc.querySelectorAll("*")){
    if(el.children.length>0) continue;
    if(/^VGA$|^Card màn hình$|^Card đồ họa$/i.test(text(el))){
      let p=el; for(let j=0;j<6&&p;j++){ if(p.querySelector&&p.querySelector("button")) return {row:p}; p=p.parentElement; }
    }
  }
  return null;
}
```

### 7.2. `waitFor` — đợi element (cho async load)
```js
function waitFor(check, timeout=6000){
  return new Promise(res=>{ const t0=Date.now(); (function loop(){
    try{const v=check(); if(v) return res(v);}catch(e){}
    if(Date.now()-t0>timeout) return res(null); setTimeout(loop,150);
  })();});
}
```

### 7.3. `findFirstProduct` — ưu tiên nút "Chọn" (stable text)
```js
function findFirstProduct(modal){
  for(const b of modal.querySelectorAll("button")){
    const t=text(b); if(/^Chọn$|^Select$/i.test(t)&&t.length<12) return b;
  }
  return modal.querySelector("[data-product-id],[data-sku]")
    || modal.querySelector(":scope > div > div:nth-of-type(1) span > div");
}
```

### 7.4. Flow tổng hợp
```js
async function autoAddVga(doc){
  const row = findVgaRow(doc); if(!row) return {ok:false,step:"vga-row"};
  syntheticClick(row.row.querySelector("button"));
  const modal = await waitFor(()=>doc.querySelector('[role="dialog"],[class*="css-fa3kpy"]'),6000);
  if(!modal) return {ok:false,step:"modal"};
  const amd = modal.querySelector('[aria-label*="AMD"]'); if(amd){ syntheticClick(amd); await wait(900); }
  const product = await waitFor(()=>findFirstProduct(modal),6000);
  if(!product) return {ok:false,step:"product"};
  syntheticClick(product); return {ok:true,step:"done"};
}
```

## 8. Hướng dẫn build production

### 8.1. Selector Manifest (Page Object) — tách config khỏi code
```json
{
  "site":"phongvu.vn/buildpc",
  "buildListContainer":"[class*='teko-col-8']:has(button[aria-label='Chọn'])",
  "categoryRow":{"by":"text","value":"VGA"},
  "categoryButton":"button[aria-label='Chọn']",
  "modal":"[role='dialog']",
  "productButton":{"by":"text","value":"Chọn"},
  "filterAmd":"[aria-label*='AMD']"
}
```
phongvu đổi UI → cập nhật manifest, **không sửa code**.

### 8.2. Wait strategy (bắt buộc)
- `waitFor(element, timeout)` — đợi element, KHÔNG đợi timeout cố định.
- Product list async → luôn `waitFor(findFirstProduct)` sau khi modal mở.
- Filter đổi list → re-`waitFor` sau khi click filter.

### 8.3. Robust selector priority
1. `[aria-label]` / `[role]` (semantic) → 2. text match → 3. `[data-*]` → 4. (chỉ khi hết cách) emotion class / nth-of-type (đánh dấu brittle, cập nhật manifest khi vỡ).

## 9. Tham chiếu
- ADR-0001 (kiến trúc), ADR-0003 (scope Extension = stretch).
- `docs/openclaw-reference.md` (browser automation tool, tool plugin SDK).
