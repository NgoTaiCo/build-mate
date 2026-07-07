# Quickstart: Demo Video Backup for S1–S3 WebChat Journey

## Prerequisites

- Node.js ≥ 22.17 LTS
- OpenClaw gateway running and WebChat available at `http://127.0.0.1:18789/`
- Sample catalog data loaded so a 25M VND gaming PC build can be compiled and repaired
- A deliberately incompatible parts selection prepared for the broken-build scene
- (Recommended) Git LFS if scene assets are large

## 1. Install presenter tooling

```bash
cd demo/video-backup
npm install
```

This installs Remotion, React, Playwright, and capture scripts locally. It does not affect the core BuildMate dependencies.

## 2. Capture scene assets

Record all S1→S3 scenes from WebChat:

```bash
npx tsx scripts/capture-all.ts
```

Captured assets are written to `public/scenes/`.

If a single scene needs re-recording:

```bash
npx tsx scripts/capture-scene.ts search
```

Replace `search` with any scene `id` defined in `src/scenes.ts`.

## 3. Preview the composition

```bash
npx remotion studio
```

Open the Studio, select the `BuildMateS1S3Demo` composition, and scrub through the timeline to verify scene order and captions.

## 4. Sanity-check a frame

```bash
npx remotion still BuildMateS1S3Demo --scale=0.25 --frame=30 out/still.png
```

This renders one frame at the 1-second mark for a quick layout check.

## 5. Render the final fallback video

```bash
npx remotion render BuildMateS1S3Demo out/buildmate-s1-s3-demo.mp4
```

The output file is an offline-playable 1080p MP4. Copy it to the venue laptop before the demo.

## Updating scenes after a script change

1. Re-run the affected capture script.
2. If the clip length changed, update `durationInFrames` in `src/scenes.ts`.
3. Re-render with `npx remotion render`.

Because scenes are stored as separate assets, unchanged scenes do not need to be re-recorded.
