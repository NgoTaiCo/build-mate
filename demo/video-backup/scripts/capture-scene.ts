#!/usr/bin/env npx tsx
/**
 * Capture a single scene from the local WebChat UI using Playwright.
 *
 * Usage:
 *   npx tsx scripts/capture-scene.ts <sceneId>
 *
 * Example:
 *   npx tsx scripts/capture-scene.ts search
 *
 * Output: public/scenes/<sceneId>.mp4
 *
 * Requires:
 *   - OpenClaw gateway running at http://127.0.0.1:18789/
 *   - Sample catalog data loaded
 */

import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";

const WEBCHAT_URL = process.env["WEBCHAT_URL"] ?? "http://127.0.0.1:18789/";
const SCENES_DIR = path.resolve(
  import.meta.dirname ?? __dirname,
  "../public/scenes"
);

// --- Inline step lookup (avoids tsx import complexity in some envs) ---
import { WEBCHAT_CAPTURE_STEPS } from "../src/capture-steps";

async function captureScene(sceneId: string): Promise<void> {
  const step = WEBCHAT_CAPTURE_STEPS.find((s) => s.sceneId === sceneId);
  if (!step) {
    const valid = WEBCHAT_CAPTURE_STEPS.map((s) => s.sceneId).join(", ");
    console.error(`Unknown scene id: "${sceneId}". Valid ids: ${valid}`);
    process.exit(1);
  }

  console.log(`[capture] Scene: ${step.sceneId} — ${step.label}`);

  const outputPath = path.join(SCENES_DIR, `${sceneId}.webm`);

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

  // Allow WebChat UI to fully load
  await page.waitForTimeout(2000);

  if (step.chatMessage) {
    // Find chat input and type the message
    const inputSelector =
      'textarea[placeholder], input[type="text"][placeholder], [contenteditable="true"]';
    await page.waitForSelector(inputSelector, { timeout: 10000 });
    const input = page.locator(inputSelector).first();
    await input.fill(step.chatMessage);
    await page.keyboard.press("Enter");
    console.log(`[capture] Sent message: "${step.chatMessage}"`);
  }

  if (step.delayBeforeRecordMs) {
    console.log(`[capture] Waiting ${step.delayBeforeRecordMs}ms for UI to settle...`);
    await page.waitForTimeout(step.delayBeforeRecordMs);
  }

  console.log(`[capture] Recording for ${step.recordMs}ms...`);
  await page.waitForTimeout(step.recordMs);

  // Close context to flush the video file
  await context.close();
  await browser.close();

  // Playwright names files with a hash; rename to our sceneId
  const files = fs.readdirSync(SCENES_DIR).filter((f) => f.endsWith(".webm"));
  const latest = files
    .map((f) => ({ f, mtime: fs.statSync(path.join(SCENES_DIR, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime)[0];

  if (latest && latest.f !== `${sceneId}.webm`) {
    const rawPath = path.join(SCENES_DIR, latest.f);
    fs.renameSync(rawPath, outputPath);
  }

  console.log(`[capture] Saved: ${outputPath}`);
  console.log(
    `[info] WebM captured. Convert to MP4 with:\n  ffmpeg -i ${outputPath} -c:v libx264 -crf 18 ${outputPath.replace(".webm", ".mp4")}`
  );
}

const sceneId = process.argv[2];
if (!sceneId) {
  console.error("Usage: npx tsx scripts/capture-scene.ts <sceneId>");
  const ids = WEBCHAT_CAPTURE_STEPS.map((s) => s.sceneId).join(", ");
  console.error(`Available scene ids: ${ids}`);
  process.exit(1);
}

captureScene(sceneId).catch((err) => {
  console.error("[capture] Error:", err);
  process.exit(1);
});
