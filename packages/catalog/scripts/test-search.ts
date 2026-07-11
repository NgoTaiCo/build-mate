/**
 * CLI tool to test searchComponentsMock
 * Run: npx tsx scripts/test-search.ts [type] [--socket AM5] [--price-max 8000000] ...
 */

import { searchComponentsMock, SearchCriteria } from "../src/index.js";

function parseArgs(): SearchCriteria & { help?: boolean } {
  const args = process.argv.slice(2);
  const criteria: SearchCriteria & { help?: boolean } = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--help" || arg === "-h") {
      criteria.help = true;
      continue;
    }

    if (arg === "--type") {
      criteria.type = args[++i] as any;
    } else if (arg === "--socket") {
      criteria.socket = args[++i];
    } else if (arg === "--ram-gen") {
      criteria.ram_gen = args[++i] as any;
    } else if (arg === "--form-factor") {
      criteria.form_factor = args[++i] as any;
    } else if (arg === "--price-min") {
      criteria.price_min = parseInt(args[++i], 10);
    } else if (arg === "--price-max") {
      criteria.price_max = parseInt(args[++i], 10);
    } else if (arg === "--stock-status") {
      criteria.stock_status = args[++i] as any;
    } else if (arg === "--clearance-mm") {
      criteria.clearance_mm = parseInt(args[++i], 10);
    } else if (arg === "--tdp-min") {
      criteria.tdp_min = parseInt(args[++i], 10);
    } else if (arg === "--tdp-max") {
      criteria.tdp_max = parseInt(args[++i], 10);
    } else if (arg === "--wattage-min") {
      criteria.wattage_min = parseInt(args[++i], 10);
    } else if (arg === "--wattage-max") {
      criteria.wattage_max = parseInt(args[++i], 10);
    } else if (!arg.startsWith("--")) {
      // First positional arg is type
      criteria.type = arg as any;
    }
  }

  return criteria;
}

function printHelp() {
  console.log(`
Usage: npx tsx scripts/test-search.ts [options]

Examples:
  # Search all components
  npx tsx scripts/test-search.ts

  # Search CPUs
  npx tsx scripts/test-search.ts --type cpu

  # AM5 CPUs under 8M VND
  npx tsx scripts/test-search.ts --type cpu --socket AM5 --price-max 8000000

  # DDR5 mainboards
  npx tsx scripts/test-search.ts --type mainboard --ram-gen DDR5

  # In-stock GPUs
  npx tsx scripts/test-search.ts --type gpu --stock-status in_stock

  # ATX cases with 300mm+ clearance
  npx tsx scripts/test-search.ts --type case --form-factor ATX --clearance-mm 300

  # PSUs 1000W+
  npx tsx scripts/test-search.ts --type psu --wattage-min 1000

Options:
  --type <type>              cpu | mainboard | ram | psu | cooler | case | storage | gpu
  --socket <socket>          AM5, LGA1700, etc.
  --ram-gen <gen>            DDR4 | DDR5
  --form-factor <factor>     ATX | mATX | ITX | SFX
  --price-min <price>        Minimum price in VND
  --price-max <price>        Maximum price in VND
  --stock-status <status>    in_stock | out_of_stock
  --clearance-mm <mm>        Minimum clearance in mm
  --tdp-min <tdp>            Minimum TDP in watts
  --tdp-max <tdp>            Maximum TDP in watts
  --wattage-min <w>          Minimum PSU wattage
  --wattage-max <w>          Maximum PSU wattage
  --help                     Show this help
`);
}

function main() {
  const criteria = parseArgs();

  if (criteria.help) {
    printHelp();
    return;
  }

  console.log("🔍 Searching catalog...\n");
  console.log("Criteria:", JSON.stringify(criteria, null, 2));
  console.log("");

  const results = searchComponentsMock(criteria);

  console.log(`Found ${results.length} component(s)\n`);

  if (results.length === 0) {
    console.log("❌ No results found");
    return;
  }

  // Show results
  results.forEach((component, i) => {
    console.log(`${i + 1}. ${component.name}`);
    console.log(`   SKU: ${component.sku}`);
    console.log(`   Type: ${component.type}`);
    console.log(`   Price: ${component.price.toLocaleString("vi-VN")} VND`);
    console.log(`   Stock: ${component.stock_status}`);

    // Show type-specific fields
    if (component.socket) {
      if (Array.isArray(component.socket)) {
        console.log(`   Sockets: [${component.socket.join(", ")}]`);
      } else {
        console.log(`   Socket: ${component.socket}`);
      }
    }
    if (component.ram_gen) console.log(`   RAM: ${component.ram_gen}`);
    if (component.form_factor) console.log(`   Form Factor: ${component.form_factor}`);
    if (component.tdp) console.log(`   TDP: ${component.tdp}W`);
    if (component.wattage) console.log(`   Wattage: ${component.wattage}W`);
    if (component.clearance_mm)
      console.log(`   Clearance: ${component.clearance_mm}mm`);

    if (component.promo) console.log(`   Promo: ${component.promo}`);
    console.log("");
  });

  // Summary
  console.log("---");
  console.log(`Total: ${results.length} component(s)`);
  if (results.length > 0) {
    const avgPrice =
      results.reduce((sum, c) => sum + c.price, 0) / results.length;
    console.log(`Average price: ${Math.round(avgPrice).toLocaleString("vi-VN")} VND`);
    console.log(
      `Price range: ${Math.min(...results.map((c) => c.price)).toLocaleString("vi-VN")} - ${Math.max(...results.map((c) => c.price)).toLocaleString("vi-VN")} VND`
    );
  }
}

main();
