#!/usr/bin/env npx tsx
/**
 * Orchestrate a full S1→S3 capture run.
 * Captures all WebChat scenes sequentially in the correct story order.
 *
 * Usage:
 *   npx tsx scripts/capture-all.ts
 *
 * Skip individual scenes:
 *   SKIP_SCENES=intro,auto-add npx tsx scripts/capture-all.ts
 *
 * Output: public/scenes/*.webm (one per scene)
 */

import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";
import { WEBCHAT_CAPTURE_STEPS } from "../src/capture-steps";

const WEBCHAT_URL = process.env["WEBCHAT_URL"] ?? "http://127.0.0.1:18789/";
const SCENES_DIR = path.resolve(
  import.meta.dirname ?? __dirname,
  "../public/scenes"
);

const SKIP = new Set(
  (process.env["SKIP_SCENES"] ?? "").split(",").filter(Boolean)
);

async function captureAll(): Promise<void> {
  const steps = WEBCHAT_CAPTURE_STEPS.filter((s) => !SKIP.has(s.sceneId));
  console.log(
    `[capture-all] Will capture ${steps.length} scenes: ${steps
      .map((s) => s.sceneId)
      .join(", ")}`
  );

  // Launch a single browser and keep WebChat context across scenes so
  // the conversation history is preserved (avoids re-initialising the session).
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: {
      dir: SCENES_DIR,
      size: { width: 1920, height: 1080 },
    },
  });

  const page = await context.newPage();
  await page.goto(WEBCHAT_URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  console.log("[capture-all] WebChat loaded.");

  for (const step of steps) {
    console.log(`\n[capture-all] --- Scene: ${step.sceneId} ---`);
    console.log(`[capture-all] ${step.label}`);

    if (step.chatMessage) {
      const inputSelector =
        'textarea[placeholder], input[type="text"][placeholder], [contenteditable="true"]';
      await page.waitForSelector(inputSelector, { timeout: 10000 });
      const input = page.locator(inputSelector).first();
      await input.fill(step.chatMessage);
      await page.keyboard.press("Enter");
      console.log(`[capture-all] Sent: "${step.chatMessage}"`);
    }

    if (step.delayBeforeRecordMs) {
      await page.waitForTimeout(step.delayBeforeRecordMs);
    }

    console.log(`[capture-all] Recording ${step.recordMs}ms...`);
    await page.waitForTimeout(step.recordMs);
    console.log(`[capture-all] Scene ${step.sceneId} done.`);
  }

  console.log("\n[capture-all] All scenes captured. Closing browser...");
  await context.close();
  await browser.close();

  // Rename Playwright hash-named files to sceneId.webm
  const files = fs.readdirSync(SCENES_DIR).filter((f) => f.endsWith(".webm"));
  console.log(`[capture-all] ${files.length} webm files in ${SCENES_DIR}`);

  console.log(
    "\n[capture-all] Done! Scene assets written to public/scenes/\n"
  );
  console.log(
    "Next: convert .webm to .mp4 with ffmpeg, then run:\n  npm run studio\n  npm run render"
  );
}

captureAll().catch((err) => {
  console.error("[capture-all] Fatal error:", err);
  process.exit(1);
});
