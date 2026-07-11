# Data Model: Extension DOM Demo

## DemoAction

`idle | locating_category | opening_modal | waiting_products | selecting_product | verifying | success | failed | cancelled`

| Field | Description |
|---|---|
| `id` | Unique user-confirmed action id. |
| `category` | Fixed `VGA` for this demo. |
| `status` | Current transition state. |
| `errorCode` | Typed failure code if failed. |
| `startedAt` | Timestamp for timeout/diagnostic. |

## BuildSnapshot

| Field | Description |
|---|---|
| `status` | `ready` or `unavailable`. |
| `components` | Visible selected category/product summaries. |
| `total` | Visible total text if readable. |
| `updatedAt` | Last normalized snapshot time. |

## ExtensionCommand

| Field | Description |
|---|---|
| `v` | Protocol version, initially 1. |
| `id` | Dedupe/idempotency key. |
| `type` | Allowlisted command type. |
| `tab` | Exact target origin/path. |
| `expiresAt` | Short command expiry. |
| `payload` | Safe UI text/category only. |

## Invariants

- No command can carry CSS selector, URL or executable code.
- Only user-confirmed `request-add` may start a DemoAction.
- Snapshot is read-only context, not extension session state.
