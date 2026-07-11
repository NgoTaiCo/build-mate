#!/usr/bin/env npx tsx
/**
 * Capture a single scene from local WebChat using screenshot polling + ffmpeg.
 *
 * Usage:
 *   npx tsx scripts/capture-scene.ts <sceneId>
 *
 * Example:
 *   npx tsx scripts/capture-scene.ts search
 *
 * Output: public/scenes/<sceneId>.mp4
 *
 * Prerequisites:
 *   - ffmpeg on PATH (brew install ffmpeg)
 *   - OpenClaw gateway at http://127.0.0.1:18789/
 */

import { chromium, type Page } from "playwright";
import path from "node:path";
import fs from "node:fs";
import { execSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { WEBCHAT_CAPTURE_STEPS } from "../src/capture-steps";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WEBCHAT_URL = process.env["WEBCHAT_URL"] ?? "http://127.0.0.1:18789/";
const SCENES_DIR = path.resolve(__dirname, "../public/scenes");
const FPS = 10;

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
      "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2",
      outputMp4,
    ],
    { encoding: "utf8" }
  );
  if (result.status !== 0) {
    throw new Error(`ffmpeg failed:\n${result.stderr}`);
  }
}

async function captureScene(sceneId: string): Promise<void> {
  if (!hasFfmpeg()) {
    console.error("[capture] ffmpeg not found. Install: brew install ffmpeg");
    process.exit(1);
  }

  const step = WEBCHAT_CAPTURE_STEPS.find((s) => s.sceneId === sceneId);
  if (!step) {
    const valid = WEBCHAT_CAPTURE_STEPS.map((s) => s.sceneId).join(", ");
    console.error(`Unknown scene: "${sceneId}". Valid: ${valid}`);
    process.exit(1);
  }

  ensureDir(SCENES_DIR);
  const outputMp4 = path.join(SCENES_DIR, `${sceneId}.mp4`);
  const framesDir = path.join(SCENES_DIR, `_frames_${sceneId}`);

  console.log(`[capture] Scene: ${sceneId} — ${step.label}`);

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  await page.goto(WEBCHAT_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2000);

  if (step.chatMessage) {
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
    console.log(`[capture] Sent: "${step.chatMessage}"`);
  }

  if (step.delayBeforeRecordMs) {
    await page.waitForTimeout(step.delayBeforeRecordMs);
  }

  console.log(`[capture] Capturing ${step.recordMs}ms @ ${FPS}fps...`);
  const frameCount = await captureFrames(page, framesDir, step.recordMs);
  console.log(`[capture] ${frameCount} frames. Assembling MP4...`);

  try {
    assembleVideo(framesDir, outputMp4);
    console.log(`[capture] Saved: ${outputMp4}`);
  } finally {
    fs.rmSync(framesDir, { recursive: true, force: true });
  }

  await context.close();
  await browser.close();
}

const sceneId = process.argv[2];
if (!sceneId) {
  const ids = WEBCHAT_CAPTURE_STEPS.map((s) => s.sceneId).join(", ");
  console.error(`Usage: npx tsx scripts/capture-scene.ts <sceneId>`);
  console.error(`Available: ${ids}`);
  process.exit(1);
}

captureScene(sceneId).catch((err) => {
  console.error("[capture] Error:", err);
  process.exit(1);
});
