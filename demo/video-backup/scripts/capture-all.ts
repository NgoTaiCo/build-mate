#!/usr/bin/env npx tsx
/**
 * Capture S1→S3 scenes from local WebChat by taking screenshot sequences.
 *
 * Strategy: poll screenshots at ~10 fps during each scene, then assemble
 * each sequence into an MP4 via ffmpeg. This avoids Playwright recordVideo
 * codec issues on macOS.
 *
 * Prerequisites:
 *   - ffmpeg on PATH (brew install ffmpeg)
 *   - OpenClaw gateway at http://127.0.0.1:18789/
 *
 * Usage:
 *   npm run capture                          # all scenes
 *   SKIP_SCENES=search,compile npm run capture
 *   WEBCHAT_URL=http://localhost:3000 npm run capture
 *
 * Output: public/scenes/<id>.mp4
 */

import { chromium, type Page } from "playwright";
import path from "node:path";
import fs from "node:fs";
import { execSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { WEBCHAT_CAPTURE_STEPS } from "../src/capture-steps";

// ── Config ──────────────────────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WEBCHAT_URL = process.env["WEBCHAT_URL"] ?? "http://127.0.0.1:18789/";
const SCENES_DIR = path.resolve(__dirname, "../public/scenes");
const FPS = 10; // screenshots per second — enough for a smooth demo video
const SKIP = new Set(
  (process.env["SKIP_SCENES"] ?? "").split(",").filter(Boolean)
);

// ── Helpers ──────────────────────────────────────────────────────────────────
function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function hasFfmpeg(): boolean {
  try {
    execSync("ffmpeg -version", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Take screenshots at ~FPS rate for durationMs milliseconds.
 * Saves frames as <framesDir>/frame-%04d.png
 */
async function captureFrames(
  page: Page,
  framesDir: string,
  durationMs: number
): Promise<number> {
  ensureDir(framesDir);
  const intervalMs = Math.round(1000 / FPS);
  const totalFrames = Math.ceil(durationMs / intervalMs);
  let frameIdx = 0;

  return new Promise((resolve, reject) => {
    const take = async () => {
      if (frameIdx >= totalFrames) {
        resolve(frameIdx);
        return;
      }
      try {
        const framePath = path.join(
          framesDir,
          `frame-${String(frameIdx).padStart(4, "0")}.png`
        );
        await page.screenshot({ path: framePath, type: "png" });
        frameIdx++;
        setTimeout(take, intervalMs);
      } catch (err) {
        reject(err);
      }
    };
    take();
  });
}

/**
 * Assemble a directory of frame-XXXX.png files into an MP4 using ffmpeg.
 */
function assembleVideo(framesDir: string, outputMp4: string): void {
  const pattern = path.join(framesDir, "frame-%04d.png");
  const result = spawnSync(
    "ffmpeg",
    [
      "-y",
      "-framerate", String(FPS),
      "-i", pattern,
      "-c:v", "libx264",
      "-crf", "18",
      "-pix_fmt", "yuv420p",
      "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2", // ensure even dimensions
      outputMp4,
    ],
    { encoding: "utf8" }
  );
  if (result.status !== 0) {
    throw new Error(`ffmpeg failed:\n${result.stderr}`);
  }
}

function cleanFrames(framesDir: string) {
  if (fs.existsSync(framesDir)) {
    fs.rmSync(framesDir, { recursive: true, force: true });
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function captureAll(): Promise<void> {
  if (!hasFfmpeg()) {
    console.error(
      "[capture-all] ffmpeg not found. Install with: brew install ffmpeg"
    );
    process.exit(1);
  }

  ensureDir(SCENES_DIR);

  const steps = WEBCHAT_CAPTURE_STEPS.filter((s) => !SKIP.has(s.sceneId));
  console.log(
    `[capture-all] Capturing ${steps.length} scenes: ${steps
      .map((s) => s.sceneId)
      .join(", ")}`
  );
  console.log(`[capture-all] WebChat URL: ${WEBCHAT_URL}`);
  console.log(`[capture-all] FPS: ${FPS}, output: ${SCENES_DIR}\n`);

  const browser = await chromium.launch({
    headless: false, // show browser so you can verify what's being captured
    args: ["--start-maximized"],
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
  });

  const page = await context.newPage();

  console.log(`[capture-all] Navigating to ${WEBCHAT_URL}...`);
  await page.goto(WEBCHAT_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(3000);
  console.log("[capture-all] Page loaded.\n");

  for (const step of steps) {
    const outputMp4 = path.join(SCENES_DIR, `${step.sceneId}.mp4`);
    const framesDir = path.join(SCENES_DIR, `_frames_${step.sceneId}`);

    console.log(`[capture-all] ── Scene: ${step.sceneId} ──`);
    console.log(`[capture-all] ${step.label}`);

    // Send chat message if this step needs one
    if (step.chatMessage) {
      try {
        const inputSelector = [
          'textarea',
          'input[type="text"]',
          '[contenteditable="true"]',
          '[role="textbox"]',
        ].join(", ");

        await page.waitForSelector(inputSelector, { timeout: 15000 });
        const input = page.locator(inputSelector).first();
        await input.click();
        await input.fill(step.chatMessage);
        await page.keyboard.press("Enter");
        console.log(`[capture-all] Sent: "${step.chatMessage}"`);
      } catch (err) {
        console.warn(
          `[capture-all] Could not find chat input for scene ${step.sceneId}:`,
          (err as Error).message
        );
      }
    }

    // Wait for UI to settle before recording
    if (step.delayBeforeRecordMs) {
      console.log(
        `[capture-all] Waiting ${step.delayBeforeRecordMs}ms for UI...`
      );
      await page.waitForTimeout(step.delayBeforeRecordMs);
    }

    // Capture frames
    console.log(
      `[capture-all] Capturing ${step.recordMs}ms @ ${FPS}fps...`
    );
    const frameCount = await captureFrames(page, framesDir, step.recordMs);
    console.log(`[capture-all] ${frameCount} frames captured.`);

    // Assemble into MP4
    console.log(`[capture-all] Assembling ${outputMp4}...`);
    try {
      assembleVideo(framesDir, outputMp4);
      console.log(`[capture-all] Saved: ${outputMp4}`);
    } finally {
      cleanFrames(framesDir);
    }

    console.log(`[capture-all] Scene ${step.sceneId} done.\n`);
  }

  await context.close();
  await browser.close();

  console.log("[capture-all] All scenes done!");
  console.log("\nNext steps:");
  console.log("  npm run durations   # sync durationInFrames from MP4 lengths");
  console.log("  npm run studio      # preview in Remotion Studio");
  console.log("  npm run render      # render final MP4");
}

captureAll().catch((err) => {
  console.error("[capture-all] Fatal error:", err);
  process.exit(1);
});
