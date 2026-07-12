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
    console.warn("[capture] Warning: Could not parse WebChat URL from extension config:", err);
  }
  return "http://127.0.0.1:18789/";
}

const WEBCHAT_URL = getWebChatUrl();
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

  const channel = process.env["BROWSER_CHANNEL"] === "" ? undefined : (process.env["BROWSER_CHANNEL"] ?? "chrome");
  const browser = await chromium.launch({
    headless: process.env["HEADLESS"] === "true",
    channel,
  });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  const chatUrl = WEBCHAT_URL.includes("/chat") ? WEBCHAT_URL : new URL("/chat?session=main", WEBCHAT_URL).toString();
  console.log(`[capture] Navigating to ${chatUrl}...`);
  await page.goto(chatUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(3000);
  console.log("[capture] Page loaded.\n");

  const connectBtn = page.locator('button:has-text("Connect")').first();
  const inputSelector = [
    'textarea',
    'input[type="text"]',
    '[contenteditable="true"]',
    '[role="textbox"]',
  ].join(", ");
  const chatInput = page.locator(inputSelector).first();

  console.log("[capture] Checking page state (login required vs already authenticated)...");
  const state = await Promise.race([
    connectBtn.waitFor({ state: "visible", timeout: 8000 }).then(() => "login"),
    chatInput.waitFor({ state: "visible", timeout: 8000 }).then(() => "chat"),
  ]).catch(() => "unknown");

  if (state === "login") {
    console.log("[capture] Gateway Dashboard login page detected. Authenticating...");
    
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
    console.log("[capture] Clicked Connect. Waiting for redirect...");
    await page.waitForTimeout(5000);
  } else if (state === "chat") {
    console.log("[capture] Already logged in. Proceeding directly to chat...");
  } else {
    console.warn("[capture] Warning: Neither login form nor chat input was found. Attempting to proceed anyway...");
  }

  // Double check that we are actually on the chat page URL
  if (!page.url().includes("/chat")) {
    const chatTarget = new URL("/chat?session=main", page.url()).toString();
    console.log(`[capture] Redirecting to chat page: ${chatTarget}`);
    await page.goto(chatTarget, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(3000);
  }

  if (step.chatMessage) {
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
