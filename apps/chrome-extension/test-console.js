/**
 * BuildMate DOM Adapter - Console Test Helper
 * 
 * Usage: Copy-paste toàn bộ file này vào Console của phongvu.vn/buildpc
 * hoặc mock-buildpc page để chạy tests.
 */

(function() {
  const adapter = globalThis.BuildMateDomAdapter;
  if (!adapter) {
    console.error("❌ BuildMateDomAdapter not found. Extension chưa load?");
    return;
  }

  const tests = {
    async readEmpty() {
      console.log("\n🧪 TEST: Read Empty Build");
      const result = adapter.readBuild();
      console.log("Result:", result);
      if (result.status === "ready" && result.components.length === 0) {
        console.log("✅ PASS: Empty build detected");
        return true;
      }
      console.log("ℹ️  Build has components:", result.components.length);
      return true;
    },

    async readExisting() {
      console.log("\n🧪 TEST: Read Existing Build");
      console.log("📝 Manually chọn 1-2 linh kiện trên UI trước khi chạy test này");
      const result = adapter.readBuild();
      console.log("Result:", result);
      
      if (result.components.length === 0) {
        console.log("⚠️  No components detected. Có chọn linh kiện chưa?");
        return false;
      }
      
      console.log(`✅ Found ${result.components.length} components`);
      result.components.forEach((comp, i) => {
        console.log(`  ${i+1}. ${comp.category}: ${comp.name} (${comp.sku})`);
      });
      console.log(`  Total: ${result.total} VND`);
      return true;
    },

    async openGpuModal() {
      console.log("\n🧪 TEST: Open GPU Modal");
      const result = await adapter.openCategory("gpu");
      console.log("Result:", result);
      
      if (!result.ok) {
        console.log(`❌ FAIL: ${result.error}`);
        return false;
      }
      
      const modal = result.modal || document.querySelector('[role="dialog"]');
      if (!modal) {
        console.log("❌ FAIL: Modal not found in DOM");
        return false;
      }
      
      console.log("✅ PASS: Modal opened");
      console.log("Modal element:", modal);
      
      // Inspect products
      const products = modal.querySelectorAll("article, div[class*='product'], button");
      console.log(`  Products/buttons found: ${products.length}`);
      
      return true;
    },

    async addTestGpu() {
      console.log("\n🧪 TEST: Add Test GPU");
      console.log("📝 Sử dụng mock component ID. Chỉ work trên mock-buildpc.");
      
      const component = {
        sku: "GPU-001",
        vendor_product_id: "PV-GPU-001",
        name: "Test Radeon RX 7800 XT",
        category: "gpu"
      };
      
      console.log("Adding:", component);
      const result = await adapter.addComponent(component);
      console.log("Result:", result);
      
      if (!result.ok) {
        console.log(`❌ FAIL: ${result.error}`);
        return false;
      }
      
      console.log("✅ PASS: Component added");
      console.log("Snapshot:", result.snapshot);
      return true;
    },

    async inspectStructure() {
      console.log("\n🔍 INSPECT: Page Structure");
      
      // Count containers
      const cols = document.querySelectorAll('[class*="teko-col-8"]');
      console.log(`📦 Found ${cols.length} teko-col-8 containers`);
      
      cols.forEach((col, i) => {
        const preview = col.textContent.replace(/\s+/g, " ").trim().substring(0, 80);
        console.log(`  [${i}] ${preview}...`);
      });
      
      // Check category rows
      console.log("\n🏷️  Category Rows:");
      const categories = ["cpu", "gpu", "ram", "mainboard", "storage", "psu"];
      for (const cat of categories) {
        const row = document.querySelector(`[data-build-category="${cat}"]`) ||
                    [...cols].flatMap(c => [...c.children]).find(r => {
                      const txt = r.textContent.toLowerCase();
                      return txt.includes(cat) || txt.includes("vga");
                    });
        console.log(`  ${cat}: ${row ? "✅ Found" : "❌ Not found"}`);
      }
      
      // Check modal
      console.log("\n🪟 Modal Selectors:");
      const modalSelectors = [
        '[data-product-modal]',
        '[role="dialog"]',
        '[class*="css-fa3kpy"]',
        '[id^="teko-modal-"]'
      ];
      modalSelectors.forEach(sel => {
        const found = document.querySelector(sel);
        console.log(`  ${sel}: ${found ? "✅ Match" : "❌ No match"}`);
      });
      
      return true;
    },

    async findRealSku() {
      console.log("\n🔍 FIND: Real Product SKU");
      console.log("📝 Manually mở modal VGA trước, rồi chạy test này");
      
      const modal = document.querySelector('[role="dialog"]');
      if (!modal) {
        console.log("❌ Modal not found. Mở modal manually trước.");
        return false;
      }
      
      const cards = modal.querySelectorAll("article, div[class*='product']");
      console.log(`Found ${cards.length} product cards`);
      
      if (cards.length === 0) {
        console.log("⚠️  No product cards. Wait for async load?");
        return false;
      }
      
      const firstCard = cards[0];
      const link = firstCard.querySelector("a[href]");
      if (link) {
        const match = link.href.match(/\/([A-Z0-9-]+)(?:\.html)?$/i);
        if (match) {
          console.log("✅ Real SKU found:", match[1]);
          console.log("📋 Copy để dùng cho addComponent test:");
          console.log(JSON.stringify({
            sku: match[1],
            vendor_product_id: match[1],
            name: firstCard.textContent.trim().substring(0, 50),
            category: "gpu"
          }, null, 2));
          return true;
        }
      }
      
      console.log("❌ Could not extract SKU from link");
      console.log("First card element:", firstCard);
      return false;
    }
  };

  // Export test suite
  globalThis.BuildMateTests = {
    runAll: async function() {
      console.log("🚀 Running All Tests...\n");
      const results = {};
      
      results.readEmpty = await tests.readEmpty();
      results.inspectStructure = await tests.inspectStructure();
      results.readExisting = await tests.readExisting();
      
      console.log("\n📊 Summary:");
      Object.entries(results).forEach(([name, pass]) => {
        console.log(`  ${pass ? "✅" : "❌"} ${name}`);
      });
      
      return results;
    },
    
    read: tests.readExisting,
    openGpu: tests.openGpuModal,
    addGpu: tests.addTestGpu,
    inspect: tests.inspectStructure,
    findSku: tests.findRealSku,
    
    help: function() {
      console.log(`
🧪 BuildMate Console Test Suite

Available commands:
  BuildMateTests.runAll()    - Chạy tất cả tests
  BuildMateTests.read()      - Test readBuild() với build hiện tại
  BuildMateTests.openGpu()   - Test mở GPU modal
  BuildMateTests.addGpu()    - Test add component (mock page only)
  BuildMateTests.inspect()   - Inspect page structure
  BuildMateTests.findSku()   - Extract real SKU từ modal

Direct adapter access:
  BuildMateDomAdapter.readBuild()
  BuildMateDomAdapter.openCategory("gpu")
  BuildMateDomAdapter.addComponent({ sku, vendor_product_id, name, category })
      `);
    }
  };

  console.log("✅ BuildMate Test Suite loaded");
  console.log("📖 Type: BuildMateTests.help()");
})();
