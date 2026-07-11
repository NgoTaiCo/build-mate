# Research: Extension DOM Demo and OpenClaw Bridge

## DOM interaction

**Decision**: Use one Page Object flow for a user-confirmed `add first VGA` demo.

- Find category via normalized `VGA`/`Card màn hình`/`Card đồ họa` text and `button[aria-label="Chọn"]`.
- Await `[role="dialog"]`, then await a product select button; never assume a modal means products are ready.
- Dispatch native bubbling pointer/mouse/click events for React; verify the category row changed or return `unverified`.
- Reject/cancel on route change, selector failure, repeated action or timeout. Never click checkout/payment/navigation.

## Build tracking

**Decision**: Observe semantic build root with one debounced MutationObserver.

Snapshots contain only category/product/price/total text that is visible in Build PC. Ignore `#buildmate-extension-root`, compare normalized snapshot before panel render, and show unavailable if parser cannot find a root.

## OpenClaw control

**Decision**: Treat the relay as a paired OpenClaw node, not a WebChat client.

The node declares `buildmate.ui.v1`; the server-side plugin invokes it with `api.runtime.nodes.invoke`. Gateway enforces node command declaration and allowlists. Command envelope:

```json
{
  "v": 1,
  "id": "request-id",
  "type": "buildmate.ui.status | buildmate.ui.suggest | buildmate.build.request-add",
  "tab": { "origin": "https://phongvu.vn", "path": "/buildpc" },
  "issuedAt": 0,
  "expiresAt": 0,
  "payload": { "message": "...", "category": "VGA" }
}
```

`status` and `suggest` only update UI. `request-add` renders a confirm card; it never clicks the page. Reject wrong version/type/tab, stale command, duplicate id, invalid category, selectors, URLs or executable code.

**Live bridge prerequisite**: healthy configured Gateway, paired node credential, plugin tool/policy/command allowlist, and a relay transport that keeps its credential outside page DOM. Do not assume an extension service worker can safely implement the Gateway device-identity protocol without explicit pairing validation.

**References**: [OpenClaw Gateway protocol](https://docs.openclaw.ai/gateway/protocol), [OpenClaw nodes](https://docs.openclaw.ai/nodes), [Chrome content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts).
