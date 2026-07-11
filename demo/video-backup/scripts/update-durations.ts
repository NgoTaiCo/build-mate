#!/usr/bin/env npx tsx
/**
 * Measure the actual duration of captured scene assets and update
 * `durationInFrames` in `src/scenes.ts` to match.
 *
 * Usage:
 *   npx tsx scripts/update-durations.ts
 *
 * Requires ffprobe (bundled with ffmpeg) on PATH.
 * Install ffmpeg: brew install ffmpeg
 */

import { execSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

const SCENES_DIR = path.resolve(
  import.meta.dirname ?? __dirname,
  "../public/scenes"
);
const SCENES_FILE = path.resolve(
  import.meta.dirname ?? __dirname,
  "../src/scenes.ts"
);

const FPS = 30;

function getDurationSeconds(filePath: string): number | null {
  try {
    const result = execSync(
      `ffprobe -v error -select_streams v:0 -show_entries stream=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`,
      { encoding: "utf8" }
    ).trim();
    const secs = parseFloat(result);
    return isNaN(secs) ? null : secs;
  } catch {
    return null;
  }
}

function updateDurations(): void {
  if (!fs.existsSync(SCENES_FILE)) {
    console.error(`scenes.ts not found at ${SCENES_FILE}`);
    process.exit(1);
  }

  let content = fs.readFileSync(SCENES_FILE, "utf8");

  const mp4Files = fs
    .readdirSync(SCENES_DIR)
    .filter((f) => f.endsWith(".mp4"));

  let updated = 0;
  for (const file of mp4Files) {
    const sceneId = path.basename(file, ".mp4");
    const filePath = path.join(SCENES_DIR, file);
    const durationSecs = getDurationSeconds(filePath);
    if (durationSecs === null) {
      console.warn(`[update-durations] Could not probe: ${file}`);
      continue;
    }
    const frames = Math.ceil(durationSecs * FPS);
    console.log(
      `[update-durations] ${sceneId}: ${durationSecs.toFixed(2)}s → ${frames} frames`
    );

    // Replace durationInFrames for this sceneId block.
    // Matches: id: "<sceneId>", ... durationInFrames: <number>
    const pattern = new RegExp(
      `(id:\\s*["']${sceneId}["'][\\s\\S]*?durationInFrames:\\s*)\\d+`,
      "m"
    );
    if (pattern.test(content)) {
      content = content.replace(pattern, `$1${frames}`);
      updated++;
    } else {
      console.warn(
        `[update-durations] No matching entry for scene id "${sceneId}" in scenes.ts`
      );
    }
  }

  fs.writeFileSync(SCENES_FILE, content, "utf8");
  console.log(
    `\n[update-durations] Updated ${updated} scene(s) in src/scenes.ts`
  );
  console.log("Re-render with: npm run render");
}

updateDurations();
