# Research: Demo Video Backup for S1–S3 WebChat Journey

## Decision: Use Remotion for final assembly

- **Decision**: Assemble and re-export the final video with Remotion (`remotion`, `@remotion/cli`, `@remotion/media`).
- **Rationale**: The user explicitly requested Remotion. It supports programmatic composition, scene reordering, caption overlays, and deterministic re-export without re-recording. It can render to an offline MP4 via the Remotion CLI.
- **Alternatives considered**:
  - Manual screen recorder + desktop video editor: simple for a one-off video but hard to re-export quickly and lacks deterministic captions.
  - FFmpeg-only concat: fast to join clips but difficult to add captions, transitions, or reorder scenes.
  - Remotion chosen because it gives the presenter full control over the timeline and supports late edits.

## Decision: Capture scene assets with Playwright

- **Decision**: Use Playwright to record short video clips of each WebChat scene.
- **Rationale**: `004-dom-build-tools` already uses Playwright for browser automation, so the team has working patterns. Playwright can launch a browser, navigate to the local WebChat UI, drive the S1→S3 interactions, and save a video file per scene. The output is deterministic and reproducible.
- **Alternatives considered**:
  - Manual OBS/screencast: non-deterministic, dependent on presenter timing, hard to re-record exactly.
  - Remotion `<Video>` pointing at a live WebChat URL: would require WebChat to be running during render and cannot capture deterministic interactions.
  - Playwright chosen for repeatable, scriptable capture.

## Decision: Separate `demo/video-backup` package

- **Decision**: Place the Remotion project under `demo/video-backup/`, outside core packages.
- **Rationale**: This isolates presenter-only dependencies (React, Remotion) from the core application and tool plugins. It respects the Constitution principle that core layers have zero runtime dependency on presenter tooling.
- **Alternatives considered**:
  - Add Remotion to the root `package.json`: would pollute core dependencies and increase install size for non-presenters.
  - Separate repository: harder to keep capture scripts and scene data in sync with WebChat changes.
  - Subdirectory chosen for isolation while staying version-controlled with the main repo.

## Decision: Output format H.264 MP4 1080p

- **Decision**: Render the final fallback video to H.264 MP4, 1920×1080, 30 fps.
- **Rationale**: 1080p MP4 is universally supported on venue laptops, plays offline, and has a reasonable file size for a 3–5 minute video.
- **Alternatives considered**:
  - WebM: may not play on all venue laptops without extra codecs.
  - 4K: unnecessary resolution, larger file, slower render.
  - 720p: acceptable but less legible for small UI text in WebChat.
  - 1080p MP4 chosen as the best fallback.

## Decision: Metadata-driven scene composition

- **Decision**: Drive the Remotion composition with a TypeScript scene metadata file (`src/scenes.ts`) that lists each scene's id, title, asset filename, duration, and optional caption.
- **Rationale**: Using metadata avoids hard-coded paths and frame numbers in React components. When a scene is re-captured or trimmed, only the metadata file needs updating.
- **Alternatives considered**:
  - Hard-code asset paths and `durationInFrames` inside each scene component: fragile and error-prone when assets change.
  - JSON configuration file: would require a JSON loader and lose type safety.
  - TypeScript metadata chosen for type safety and simplicity.
