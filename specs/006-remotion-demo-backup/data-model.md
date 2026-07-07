# Data Model: Demo Video Backup for S1–S3 WebChat Journey

## Scene Asset

Represents one captured video clip of a step in the WebChat journey.

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Unique scene identifier. Examples: `intro`, `search`, `compile`, `broken-build`, `detect-errors`, `repair`, `auto-add`. |
| `title` | `string` | Human-readable label used for captions and Studio navigation. |
| `src` | `string` | Filename of the asset under `public/scenes/`. Example: `search.mp4`. |
| `durationInFrames` | `number` | Length of the clip in frames at the composition fps. |
| `startFrame` | `number` | Frame at which the scene begins in the final composition. |
| `caption` | `string?` | Optional short caption overlay shown during the scene. |

## Demo Video Composition

Top-level configuration for the fallback video.

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Composition identifier. Example: `BuildMateS1S3Demo`. |
| `fps` | `number` | Frames per second. Default `30`. |
| `width` | `number` | Canvas width in pixels. Default `1920`. |
| `height` | `number` | Canvas height in pixels. Default `1080`. |
| `scenes` | `SceneAsset[]` | Ordered list of scenes that form the narrative. |
| `captionsEnabled` | `boolean` | Whether caption overlays are rendered. Default `true`. |

## Build Configuration (sample capture data)

Represents the parts list shown during compile and repair scenes.

| Field | Type | Description |
|---|---|---|
| `budget` | `number` | Target budget in VND. Example: `25000000`. |
| `cpu` | `string` | CPU SKU. |
| `motherboard` | `string` | Mainboard SKU. |
| `ram` | `string` | RAM SKU. |
| `gpu` | `string` | GPU SKU. |
| `storage` | `string` | Storage SKU. |
| `psu` | `string` | PSU SKU. |
| `case` | `string` | Case SKU. |

## Error/Repair Pair (sample capture data)

Represents a compatibility error and its corrected state.

| Field | Type | Description |
|---|---|---|
| `errorCode` | `string` | Deterministic error code. Example: `E001 SOCKET_MISMATCH`. |
| `errorMessage` | `string` | Human-readable explanation shown during the detect-errors scene. |
| `originalPart` | `string` | The incompatible part selected in the broken build. |
| `replacementPart` | `string` | The corrected part after repair. |

## Relationships

- A `Demo Video Composition` contains one or more `Scene Asset` records in a fixed order.
- `Build Configuration` and `Error/Repair Pair` are sample inputs used while capturing the `compile`, `broken-build`, `detect-errors`, and `repair` scenes. They are not persisted as runtime data; they are embedded in the captured video assets.
