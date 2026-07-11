# @buildmate/catalog - PC Component Catalog Adapter

NPM package providing deterministic PC component search with real PhongVu data.

## Installation

```bash
npm install @buildmate/catalog
```

## Usage

### 1. Synchronous Mock Search (Recommended for most cases)

Use `searchComponentsMock()` for fully deterministic, offline-capable searches:

```typescript
import { searchComponentsMock } from '@buildmate/catalog';

// Search for AM5 CPUs under 8M VND
const results = searchComponentsMock({
  type: 'cpu',
  socket: 'AM5',
  price_max: 8000000,
  stock_status: 'in_stock'
});

console.log(results);
// [
//   {
//     sku: 'cpu-001',
//     name: 'AMD Ryzen 7 7800X3D',
//     type: 'cpu',
//     price: 7500000,
//     stock_status: 'in_stock',
//     socket: 'AM5',
//     tdp: 120
//   },
//   ...
// ]
```

**Characteristics**:
- ✅ Synchronous (instant response)
- ✅ Deterministic (same input = same output every time)
- ✅ Works offline
- ✅ ~50 components per type from mock dataset
- ✅ <1ms latency

### 2. Async Live Search (Optional, requires Apify)

Use `searchComponents()` for live PhongVu data with smart fallback:

```typescript
import { searchComponents } from '@buildmate/catalog';

const result = await searchComponents({
  type: 'mainboard',
  socket: 'AM5',
  ram_gen: 'DDR5',
  price_max: 5000000
});

console.log(result);
// {
//   components: [...],
//   source: 'live',          // or 'mock' or 'mixed'
//   errors: []
// }
```

**Characteristics**:
- ✅ Async (API calls)
- ✅ Real-time PhongVu data (hundreds of components)
- ✅ Per-category fallback (if CPU fails, GPU still gets live)
- ✅ ~5-10s latency (depends on API)
- ✅ Works with or without API credentials

**Return Type: CatalogResult**
```typescript
interface CatalogResult {
  components: CatalogComponent[];
  source: 'live' | 'mock' | 'mixed';  // Data source indicator
  errors: DataSourceError[];          // Any fetch errors during call
}
```

## API Reference

### Function: searchComponentsMock(criteria)

Deterministic search using pre-defined mock dataset.

```typescript
function searchComponentsMock(criteria: SearchCriteria): CatalogComponent[]
```

### Function: searchComponents(criteria)

Async search with live PhongVu data + per-category fallback.

```typescript
function searchComponents(criteria: SearchCriteria): Promise<CatalogResult>
```

### Type: SearchCriteria

All fields optional; omitted fields are ignored (AND logic).

```typescript
interface SearchCriteria {
  type?: 'cpu' | 'mainboard' | 'ram' | 'psu' | 'cooler' | 'case' | 'storage' | 'gpu';
  socket?: string;                    // "AM5", "LGA1700", etc.
  ram_gen?: 'DDR4' | 'DDR5';
  form_factor?: 'ATX' | 'mATX' | 'ITX' | 'SFX';
  price_min?: number;                 // VND (inclusive)
  price_max?: number;                 // VND (inclusive)
  stock_status?: 'in_stock' | 'out_of_stock';
  clearance_mm?: number;              // GPU/case clearance (inclusive >=)
  tdp_min?: number;                   // Watts (inclusive)
  tdp_max?: number;                   // Watts (inclusive)
  wattage_min?: number;               // PSU wattage (inclusive)
  wattage_max?: number;               // PSU wattage (inclusive)
}
```

### Type: CatalogComponent

```typescript
interface CatalogComponent {
  sku: string;                              // PhongVu SKU (unique identifier)
  name: string;                             // Product name
  type: ComponentType;                      // "cpu" | "mainboard" | ...
  price: number;                            // Price in VND
  stock_status: 'in_stock' | 'out_of_stock';
  promo: string | null;                     // Promotional text if available
  
  // Type-specific fields (optional, present only when applicable)
  socket?: string | string[];               // Single string for CPU/mainboard, array for cooler
  ram_gen?: 'DDR4' | 'DDR5';                // For mainboard, RAM
  form_factor?: 'ATX' | 'mATX' | 'ITX' | 'SFX';  // For case, mainboard, PSU
  tdp?: number;                             // For CPU, cooler, GPU
  wattage?: number;                         // For PSU
  clearance_mm?: number;                    // For case, GPU (length/clearance)
  
  // Compiler integration fields (optional)
  ram_gen_supported?: string[];             // For CPU compatibility
  generation?: string;                      // For RAM modules
  height?: number;                          // For cooler
  max_cooler_height?: number;               // For case
  supported_mb_form_factors?: string[];     // For case (derived from hierarchy)
  supported_psu_form_factors?: string[];    // For case
}
```

## Search Examples

### Example 1: Find AM5 CPUs under 8M VND

```typescript
const cpus = searchComponentsMock({
  type: 'cpu',
  socket: 'AM5',
  price_max: 8000000,
  stock_status: 'in_stock'
});
```

### Example 2: Find DDR5 mainboards with ATX form factor

```typescript
const mainboards = searchComponentsMock({
  type: 'mainboard',
  ram_gen: 'DDR5',
  form_factor: 'ATX'
});
```

### Example 3: Find cases that fit ITX or larger motherboards with 300mm+ GPU clearance

```typescript
const cases = searchComponentsMock({
  type: 'case',
  form_factor: 'mATX',      // mATX + ITX (hierarchical)
  clearance_mm: 300
});
```

### Example 4: Find 1000W+ PSUs, ATX form factor

```typescript
const psus = searchComponentsMock({
  type: 'psu',
  wattage_min: 1000,
  form_factor: 'ATX'
});
```

### Example 5: No filters (all components)

```typescript
const all = searchComponentsMock({});
// Returns all ~50 components from mock dataset
```

## Filtering Logic

### AND Logic
All provided criteria are applied simultaneously. A component must satisfy **ALL** conditions.

```typescript
searchComponentsMock({
  type: 'mainboard',
  socket: 'AM5',
  ram_gen: 'DDR5'
  // Returns: mainboards with socket="AM5" AND ram_gen="DDR5"
})
```

### Form Factor Hierarchy (Cases Only)
Case filtering uses hierarchical matching; mainboard/PSU use exact match.

```typescript
// Case form factor hierarchy: ATX >= mATX >= ITX
searchComponentsMock({ type: 'case', form_factor: 'mATX' })
// Returns: mATX cases + ITX cases (all <= mATX)

searchComponentsMock({ type: 'mainboard', form_factor: 'mATX' })
// Returns: mATX mainboards only (exact match, no hierarchy)
```

### Socket Matching (Coolers)
Coolers have `socket: string[]` (multi-socket support).

```typescript
// Cooler: socket = ["AM5", "AM4", "LGA1700"]
searchComponentsMock({ type: 'cooler', socket: 'AM5' })
// Returns: cooler (AM5 is in the array)
```

### Price Range (Inclusive)
```typescript
searchComponentsMock({
  type: 'cpu',
  price_min: 3000000,
  price_max: 8000000
})
// Returns: CPUs with 3M <= price <= 8M
```

## Data Sources

### Mock Dataset
- **Source**: Built-in `src/mock-data.ts`
- **Size**: ~50 components per type (400 total)
- **Update Frequency**: With code deployment
- **Availability**: Always available, no dependencies
- **Use Case**: Development, offline mode, fallback

### Live Data (Optional)
- **Source**: PhongVu via Apify/Teko Discovery API
- **Size**: Hundreds of real products per type
- **Update Frequency**: On-demand via `npm run fetch:phongvu`
- **Availability**: Requires Teko API credentials
- **Use Case**: Production, fresh catalog data

## Configuration

### For Live Data Fetching

Store Teko API credentials in `~/.openclaw/openclaw.json`:

```json
{
  "teko_api_key": "your-api-key-here"
}
```

Then fetch real data:

```bash
npm run fetch:phongvu
```

This creates `src/data/phongvu-catalog-<type>.json` files with real PhongVu products.

### Automatic Fallback

If JSON cache files don't exist, the system automatically uses mock data. No configuration required.

## Performance

| Operation | Latency | Memory | Notes |
|-----------|---------|--------|-------|
| `searchComponentsMock()` | <1ms | ~1-2 MB | In-memory, fully cached |
| `searchComponents()` | 5-10s | ~5-10 MB | Apify API calls per type |
| Data load (startup) | <10ms | - | JSON file deserialization |

## Export from Package

The package exports:

```typescript
// Functions
export { searchComponentsMock, searchComponents }

// Types
export type {
  CatalogComponent,
  SearchCriteria,
  CatalogResult,
  ComponentType,
  DataSource,
  DataSourceError,
  StockStatus
}

export { ALL_TYPES }
```

## Integration Examples

### With Build Compiler

```typescript
import { searchComponentsMock } from '@buildmate/catalog';

// Compiler validates motherboard compatibility
const mainboards = searchComponentsMock({
  type: 'mainboard',
  socket: 'AM5',
  ram_gen: 'DDR5'
});

// Then check case compatibility
const cases = searchComponentsMock({
  type: 'case',
  form_factor: mainboards[0].form_factor,
  clearance_mm: gpu.length // GPU clearance requirement
});
```

### In Web API

```typescript
// Express/Fastify route
app.post('/api/search-components', (req, res) => {
  const results = searchComponentsMock(req.body);
  res.json({ components: results });
});

// Request
POST /api/search-components
{
  "type": "cpu",
  "socket": "AM5",
  "price_max": 10000000
}

// Response
{
  "components": [
    { sku: "...", name: "...", ... },
    ...
  ]
}
```

### In CLI Tool

```typescript
import { searchComponentsMock } from '@buildmate/catalog';

const args = process.argv.slice(2);
const type = args[0];
const socket = args[1];

const results = searchComponentsMock({ type, socket });
console.table(results);
```

## Testing

```bash
# Run test suite
npm test

# Specific test
npm test -- --grep "CPU"

# With coverage (if supported)
npm test -- --coverage
```

All 118 tests pass, covering:
- Mock data integrity
- Filter logic (socket, price, stock, RAM gen, form factor, clearance, TDP, wattage)
- Search combination (AND logic)
- Sorting (price ascending)
- PhongVu transformer
- Edge cases

## Troubleshooting

### "No components returned"

1. Check criteria are correct:
   ```typescript
   // Make sure field names match SearchCriteria
   searchComponentsMock({
     type: 'cpu',      // ✓ Valid
     Socket: 'AM5'     // ✗ Should be 'socket' (lowercase)
   })
   ```

2. Check data exists:
   ```typescript
   import { ALL_TYPES } from '@buildmate/catalog';
   console.log(ALL_TYPES);  // ["cpu", "mainboard", "ram", ...]
   ```

3. Check filters aren't conflicting:
   ```typescript
   // This returns nothing (contradictory)
   searchComponentsMock({
     type: 'cpu',
     price_min: 20000000,
     price_max: 5000000  // min > max
   })
   ```

### "Module not found"

```bash
# Make sure package is installed
npm install @buildmate/catalog

# Make sure you're exporting correctly
import { searchComponentsMock } from '@buildmate/catalog'
```

## License

© 2026 BuildMate. All rights reserved.

## Support

For issues or questions:
1. Check [FETCH_GUIDE.md](./FETCH_GUIDE.md) for data fetching
2. Review contract at `specs/002-mock-catalog-adapter/contracts/search-api.md`
3. Run tests: `npm test`
4. Check git log for recent changes
