# Contract: Extension DOM Demo and Bridge

## Exact-page gate

Content script and every DOM action must require:

```text
protocol = https:
hostname = phongvu.vn
pathname = /buildpc
```

No www host, subpath, query-driven alternative page, iframe or navigation target is supported.

## User-confirmed DOM action

Input: `{ category: "VGA" }` from the panel only.

Output:

```json
{ "ok": true, "status": "success | failed | cancelled", "step": "...", "message": "...", "snapshot": {} }
```

Failure steps are one of `VGA_ROW_NOT_FOUND`, `CATEGORY_BUTTON_NOT_FOUND`, `MODAL_TIMEOUT`, `PRODUCT_TIMEOUT`, `VERIFY_TIMEOUT`, `PAGE_CHANGED`, `CANCELLED`.

## Bridge command policy

| Command | Effect | Confirmation |
|---|---|---|
| `buildmate.ui.status` | Update status text | No |
| `buildmate.ui.suggest` | Render suggestion | No |
| `buildmate.build.request-add` | Render confirmation card | Required |

Invalid/stale/wrong-tab commands return `rejected` and do not alter Phong Vu DOM.

## Extension → OpenClaw events

Extension only sends bounded, structured context through the paired relay. It never sends page HTML, arbitrary DOM selectors, cookies, credentials or a full extension chat history.

```json
{
  "v": 1,
  "id": "event-id",
  "type": "buildmate.page.snapshot | buildmate.user.message | buildmate.dom.action-result",
  "tab": { "origin": "https://phongvu.vn", "path": "/buildpc" },
  "at": 0,
  "payload": {
    "snapshot": { "status": "ready", "components": [], "total": null },
    "message": "optional user text",
    "action": { "status": "success | failed | rejected", "code": "optional" }
  }
}
```

`buildmate.user.message` is routed into an OpenClaw gateway-owned session. A snapshot is read-only context; an action result lets the agent explain the actual outcome instead of assuming success.

## OpenClaw → Extension command payload

Commands contain user-facing text, optional suggested SKU/component data and fixed category enums only. They MUST NOT contain DOM selectors, JavaScript, URLs, browser credentials or checkout instructions.

## Non-goals

- Checkout/payment/navigation/multi-tab.
- Arbitrary agent DOM command execution.
- Extension-owned session/memory, live relay credentials, direct WebChat protocol control, or anti-bot bypass.
