# Implementation Plan: Demo Video Backup for S1–S3 WebChat Journey

**Branch**: `006-remotion-demo-backup` | **Date**: 2026-07-07 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/006-remotion-demo-backup/spec.md`

## Summary

Build a presenter-only fallback demo video that demonstrates the complete BuildMate S1→S3 journey inside WebChat. Scene assets are captured from the local WebChat UI and assembled/re-exported with Remotion. The final deliverable is an offline-playable MP4 between 3 and 5 minutes. Remotion and related presenter tooling are isolated from the core BuildMate application.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js ≥ 22.17 LTS, React 18  
**Primary Dependencies**: Remotion (`remotion`, `@remotion/cli`, `@remotion/media`), Playwright (deterministic WebChat scene capture), `tsx`  
**Storage**: N/A — local files only (scene assets in `demo/video-backup/public/scenes/`)  
**Testing**: Visual review of rendered video, `npx remotion still` sanity checks, checksum validation of scene assets  
**Target Platform**: Presenter laptop (Windows/macOS/Linux) for capture/assembly; standard HD playback device for venue  
**Project Type**: Demo video composition project + capture scripts  
**Performance Goals**: Re-export final video within 30 minutes; render a 5-minute 1080p video in under 10 minutes on the presenter laptop  
**Constraints**: Offline playback, 3–5 minute duration, 1920×1080 HD output, S2/S4 excluded, Remotion only in presenter environment, fit hackathon time-box 14–16h  
**Scale/Scope**: One presenter, one fallback video, reusable scene assets for optional future S2/S4 extension

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| # | Principle | Check | Result |
|---|---|---|---|
| 1 | OpenClaw owns session/memory | Feature only consumes WebChat UI as content source; does not build SessionStore, backend gateway, or channel plumbing. | PASS |
| 2 | Build Compiler = deterministic pure functions | Feature does not modify the Compiler; it only demonstrates existing S1/S3 behavior captured from WebChat. | PASS |
| 3 | Model = provider config | Feature does not add an LLM orchestration layer or model provider wrapper. | PASS |
| 4 | WebChat = channel primary | Scene assets are captured from the WebChat primary channel. | PASS |
| 5 | Docs Tiếng Việt + English terms | Plan/spec use English with technical terms preserved; user-facing docs follow project convention. | PASS |

**Verdict**: APPROVED — no boundary violations.

## Project Structure

### Documentation (this feature)

```text
specs/006-remotion-demo-backup/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command output)
├── data-model.md        # Phase 1 output (/speckit.plan command output)
├── quickstart.md        # Phase 1 output (/speckit.plan command output)
├── contracts/           # Phase 1 output (/speckit.plan command output)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
demo/
└── video-backup/              # Presenter-only Remotion project
    ├── package.json
    ├── remotion.config.ts
    ├── tsconfig.json
    ├── src/
    │   ├── Root.tsx           # Compositions and metadata
    │   ├── DemoVideo.tsx      # Main S1→S3 composition
    │   ├── scenes/
    │   │   ├── IntroScene.tsx
    │   │   ├── SearchScene.tsx
    │   │   ├── CompileScene.tsx
    │   │   ├── BrokenBuildScene.tsx
    │   │   ├── DetectErrorsScene.tsx
    │   │   ├── RepairScene.tsx
    │   │   └── OutroScene.tsx
    │   ├── components/
    │   │   └── Caption.tsx
    │   └── scenes.ts          # Scene metadata and ordering
    ├── public/
    │   └── scenes/            # Captured scene assets (mp4/webm)
    ├── scripts/
    │   ├── capture-scene.ts   # Capture one scene from WebChat
    │   └── capture-all.ts     # Orchestrate full S1→S3 capture run
    └── README.md
```

**Structure Decision**: A standalone `demo/video-backup` Remotion project keeps presenter tooling isolated from the core application. Scene assets live under `public/scenes/` so Remotion can reference them via `staticFile()`. Capture scripts use Playwright to record deterministic clips from the local WebChat UI, reusing the browser-automation approach already established in `004-dom-build-tools`.

## Complexity Tracking

None — all Constitution Check gates pass without justification.
