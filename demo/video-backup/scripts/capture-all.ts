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

function getWebChatUrl(): string {
  if (process.env["WEBCHAT_URL"]) {
    return process.env["WEBCHAT_URL"];
  }
  try {
    const bgPath = path.resolve(__dirname, "../../../apps/chrome-extension/background.js");
    if (fs.existsSync(bgPath)) {
      const content = fs.readFileSync(bgPath, "utf8");
      const match = content.match(/const DEFAULT_BRIDGE_URL\s*=\s*["']([^"']+)["']/);
      if (match && match[1]) {
        return match[1]
          .replace(/^wss?:\/\//i, (m) => (m.toLowerCase().startsWith("wss") ? "https://" : "http://"))
          .replace(/\/dom-bridge\/?$/i, "");
      }
    }
  } catch (err) {
    console.warn("[capture-all] Warning: Could not parse WebChat URL from extension config:", err);
  }
  return "http://127.0.0.1:18789/";
}

const WEBCHAT_URL = getWebChatUrl();
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

  const channel = process.env["BROWSER_CHANNEL"] === "" ? undefined : (process.env["BROWSER_CHANNEL"] ?? "chrome");
  const browser = await chromium.launch({
    headless: process.env["HEADLESS"] === "true", // show browser by default so you can verify what's being captured
    channel,
    args: ["--start-maximized"],
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
  });

  const page = await context.newPage();

  const chatUrl = WEBCHAT_URL.includes("/chat") ? WEBCHAT_URL : new URL("/chat?session=main", WEBCHAT_URL).toString();
  console.log(`[capture-all] Navigating to ${chatUrl}...`);
  await page.goto(chatUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(3000);
  console.log("[capture-all] Page loaded.\n");

  const connectBtn = page.locator('button:has-text("Connect")').first();
  const inputSelector = [
    'textarea',
    'input[type="text"]',
    '[contenteditable="true"]',
    '[role="textbox"]',
  ].join(", ");
  const chatInput = page.locator(inputSelector).first();

  console.log("[capture-all] Checking page state (login required vs already authenticated)...");
  const state = await Promise.race([
    connectBtn.waitFor({ state: "visible", timeout: 8000 }).then(() => "login"),
    chatInput.waitFor({ state: "visible", timeout: 8000 }).then(() => "chat"),
  ]).catch(() => "unknown");

  if (state === "login") {
    console.log("[capture-all] Gateway Dashboard login page detected. Authenticating...");
    
    // Fill the token
    const tokenInput = page.locator('input#token, input[placeholder*="token" i], input[type="password"]').first();
    const gatewayToken = process.env["OPENCLAW_GATEWAY_TOKEN"] ?? "4129e3440d35bbd04d3e72b9144cc96fda776f7919c2df60";
    await tokenInput.fill(gatewayToken);
    
    // Optionally fill the WebSocket URL if it's empty
    const wsInput = page.locator('input[placeholder*="ws://" i], input[type="text"]').first();
    if (await wsInput.isVisible()) {
      const currentWs = await wsInput.inputValue();
      if (!currentWs) {
        const wsProtocol = page.url().startsWith("https") ? "wss" : "ws";
        const wsHost = new URL(page.url()).host;
        await wsInput.fill(`${wsProtocol}://${wsHost}`);
      }
    }
    
    // Click connect and wait
    await connectBtn.click();
    console.log("[capture-all] Clicked Connect. Waiting for redirect...");
    await page.waitForTimeout(5000);
  } else if (state === "chat") {
    console.log("[capture-all] Already logged in. Proceeding directly to chat...");
  } else {
    console.warn("[capture-all] Warning: Neither login form nor chat input was found. Attempting to proceed anyway...");
  }

  // Double check that we are actually on the chat page URL
  if (!page.url().includes("/chat")) {
    const chatTarget = new URL("/chat?session=main", page.url()).toString();
    console.log(`[capture-all] Redirecting to chat page: ${chatTarget}`);
    await page.goto(chatTarget, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(3000);
  }

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

        const input = page.locator(inputSelector).first();
        await input.waitFor({ state: "visible", timeout: 15000 });
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
