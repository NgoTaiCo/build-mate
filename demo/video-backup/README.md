# BuildMate Demo Video Backup

Presenter-only Remotion project for the BuildMate S1→S3 fallback demo video.

**Output**: `out/buildmate-s1-s3-demo.mp4` — 1080p MP4, 3–5 minutes, offline-playable.

---

## Quick Start

### 1. Install (first time only)

```bash
cd demo/video-backup
npm install
npx playwright install chromium
```

### 2. Capture scenes from WebChat

Make sure OpenClaw gateway is running (`openclaw gateway`) and WebChat is available at `http://127.0.0.1:18789/`.

```bash
# Capture all scenes in one run
npm run capture

# Or capture a single scene by id
npm run capture:scene search
```

Available scene ids: `search`, `compile`, `broken-build`, `detect-errors`, `repair`, `auto-add`

> Captured files are saved as `.webm` in `public/scenes/`.
> Convert to MP4 with ffmpeg before rendering (see below).

### 3. Convert WebM → MP4

```bash
# Convert all captured scenes
for f in public/scenes/*.webm; do
  ffmpeg -i "$f" -c:v libx264 -crf 18 "${f%.webm}.mp4" -y
done
```

### 4. Update scene durations

After converting to MP4, sync `durationInFrames` in `src/scenes.ts`:

```bash
npm run durations
```

### 5. Preview in Remotion Studio

```bash
npm run studio
```

Open `http://localhost:3000` → select `BuildMateS1S3Demo` → scrub through all 7 scenes.

### 6. Render final video

```bash
npm run render
```

Output: `out/buildmate-s1-s3-demo.mp4`

Copy this file to the venue laptop before the demo.

---

## Scene List (S1→S3)

| # | Scene ID | What it shows | Source |
|---|---|---|---|
| 1 | `intro` | BuildMate title card | Remotion-generated |
| 2 | `search` | Khách nhập yêu cầu PC gaming 25M | WebChat capture |
| 3 | `compile` | Build Compiler trả về cấu hình | WebChat capture |
| 4 | `broken-build` | Khách chọn linh kiện không tương thích | WebChat capture |
| 5 | `detect-errors` | E001 SOCKET_MISMATCH được phát hiện | WebChat capture |
| 6 | `repair` | Repair workflow sửa CPU | WebChat capture |
| 7 | `auto-add` | Build hợp lệ thêm vào giỏ hàng | WebChat capture |

---

## Re-export after editing

1. Re-capture the changed scene: `npm run capture:scene <id>`
2. Convert: `ffmpeg -i public/scenes/<id>.webm -c:v libx264 -crf 18 public/scenes/<id>.mp4 -y`
3. Update durations: `npm run durations`
4. Re-render: `npm run render`

Total time for re-export: < 30 minutes.

---

## S2/S4 Extension

Optional stretch scenes are defined but disabled in `src/scenes.ts`.
To enable: uncomment the `s2-compare` block and capture the corresponding asset.

---

## Dependency Isolation

This project is presenter-only. It has its own `package.json` and does NOT
affect the core BuildMate packages (`@buildmate/compiler`, `@buildmate/catalog`, etc.).
