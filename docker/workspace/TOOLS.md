# BuildMate — Tool Reference

All tools are exposed via the MCP server (`@buildmate/buildpc-mcp-server`). Tools are split into two groups: **Compiler tools** (pure functions, deterministic) and **DOM tools** (interact with the extension via relay).

## Compiler tools (deterministic, pure functions)

These have no side effects. Call freely; repeated calls with the same input produce the same output.

### compile_build

Validate a PC build and return errors, a repair plan, and validity in one call.

**Input:**
```json
{
  "build": {
    "components": [
      { "type": "cpu", "id": "cpu-001", "socket": "AM5", "ram_gen_supported": ["DDR5"], "tdp": 65 },
      { "type": "mainboard", "id": "mb-001", "socket": "AM5", "ram_gen_supported": ["DDR5"], "form_factor": "ATX" },
      { "type": "ram", "id": "ram-001", "generation": "DDR5" },
      { "type": "gpu", "id": "gpu-001", "tdp": 200 },
      { "type": "psu", "id": "psu-001", "wattage": 750, "form_factor": "ATX" },
      { "type": "cooler", "id": "cool-001", "height": 155 },
      { "type": "case", "id": "case-001", "max_cooler_height": 165, "supported_mb_form_factors": ["ATX"], "supported_psu_form_factors": ["ATX"] },
      { "type": "storage", "id": "ssd-001" }
    ]
  }
}
```

**Output:**
```json
{
  "errors": [
    { "code": "E001", "severity": "error", "name": "SOCKET_MISMATCH", "message": "...", "component_refs": ["cpu-001", "mb-001"] }
  ],
  "repair_plan": [
    { "error_code": "E001", "fixes": [...], "rationale": "..." }
  ],
  "is_valid": false
}
```

**Usage:** Call after assembling a build draft from search results. Always call before `add_to_build`.

### detect_errors

Same as compile_build but returns only the errors array, without a repair plan. Use when you only need to check, not to repair.

**Input:** same as compile_build.
**Output:** `CompilerError[]` (array of errors).

### repair_build

Generate a repair plan from a build and its known errors.

**Input:**
```json
{
  "build": { "components": [...] },
  "errors": [
    { "code": "E001", "severity": "error", "name": "SOCKET_MISMATCH", "message": "...", "component_refs": ["cpu-001", "mb-001"] }
  ]
}
```

**Output:** `RepairPlan[]` — each plan has `error_code`, `fixes` (concrete changes), and `rationale`.

**Usage:** Call after `detect_errors` when errors are present. Present the repair options to the user.

### search_components

Search the Phong Vu product catalog by criteria.

**Input (all fields optional):**
```json
{
  "type": "cpu",           // cpu | mainboard | ram | psu | cooler | case | storage | gpu
  "socket": "AM5",         // filter CPU and mainboard
  "ram_gen": "DDR5",       // filter RAM and mainboard
  "form_factor": "ATX",    // filter case, mainboard, PSU
  "price_min": 1000000,
  "price_max": 5000000,
  "stock_status": "in_stock",
  "clearance_mm": 160,     // max cooler height, filters coolers
  "tdp_min": 100,
  "tdp_max": 200,
  "wattage_min": 650,      // filter PSU
  "wattage_max": 850
}
```

**Output:**
```json
{
  "count": 3,
  "components": [
    {
      "sku": "PV-CPU-001",
      "name": "AMD Ryzen 5 7600",
      "type": "cpu",
      "price": 4990000,
      "stock_status": "in_stock",
      "promo": null,
      "socket": "AM5",
      "tdp": 65,
      "ram_gen_supported": ["DDR5"]
    }
  ]
}
```

**Usage:** Search per type separately. Use `sku` as `vendor_product_id` when calling `add_to_build`. Use the technical attributes (`socket`, `tdp`, `ram_gen`, `wattage`, `height`, `form_factor`, `max_cooler_height`) to assemble the build draft for `compile_build`.

---

## DOM tools (side effects — via relay)

These tools interact with the Chrome extension over an HTTP relay. They **require context_id** and **require user confirmation**.

### read_current_build

Read the build currently displayed on the Phong Vu Build PC page.

**Input:** `{ "context_id": "<uuid>" }`
**Output:**
```json
{
  "command_id": "...",
  "ok": true,
  "snapshot": {
    "status": "ready",
    "components": [
      { "sku": "CPU-001", "vendor_product_id": "PV-CPU-001", "name": "AMD Ryzen 5 7600", "category": "cpu" }
    ],
    "total": 4990000,
    "revision": "..."
  }
}
```

**Usage:** Use to see what the user has already added. No side effects — call freely.

### add_to_build

Add one component to the Build PC page. The extension will open the category, find the product, and click "Chon" (Select).

**Input:**
```json
{
  "context_id": "<uuid>",
  "component": {
    "sku": "PV-CPU-001",
    "vendor_product_id": "PV-CPU-001",
    "name": "AMD Ryzen 5 7600",
    "category": "cpu"
  }
}
```

**Output:**
```json
{
  "command_id": "...",
  "ok": true,
  "added": { "sku": "PV-CPU-001", "name": "AMD Ryzen 5 7600", "category": "cpu" },
  "snapshot": { "... new build after adding ..." }
}
```

**Errors:** `COMPONENT_ALREADY_SELECTED`, `CATEGORY_NOT_FOUND`, `PRODUCT_NOT_FOUND`, `PRODUCT_OUT_OF_STOCK`, `MODAL_TIMEOUT`, `VERIFY_TIMEOUT`.

**Policy:**
- ONLY call after `compile_build` returns `is_valid: true`.
- ONLY call after the user confirms ("OK", "yes", "confirm", "xac nhan", etc.).
- Call one component at a time. Report the result after each call.
- `vendor_product_id` must be a real SKU from the catalog. Never fabricate one.

### revert_component

Remove one component from the Build PC page.

**Input:**
```json
{
  "context_id": "<uuid>",
  "component": {
    "sku": "PV-CPU-001",
    "vendor_product_id": "PV-CPU-001",
    "name": "AMD Ryzen 5 7600",
    "category": "cpu"
  },
  "expected_revision": "..."  // optional, ensures no one else changed the build in between
}
```

**Output:** `{ "ok": true, "removed": { ... }, "snapshot": { ... } }`

**Errors:** `COMPONENT_NOT_SELECTED`, `REVERT_CONFLICT`, `REMOVE_BUTTON_NOT_FOUND`, `REMOVE_VERIFY_TIMEOUT`.

**Policy:**
- ONLY call after the user confirms.
- Use in the repair workflow when swapping a component.

---

## Built-in tools (OpenClaw)

### exec

Use to run `curl` for relay discovery.

**Example — list active contexts:**
```bash
curl -s http://127.0.0.1:8781/contexts
```

**Example — check relay health:**
```bash
curl -s http://127.0.0.1:8781/contexts | head -20
```

> Use `exec` only for discovery/debug. Do not use `exec` to interact with the Phong Vu page directly.
