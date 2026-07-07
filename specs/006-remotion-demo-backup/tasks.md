# Tasks: Demo Video Backup for S1–S3 WebChat Journey

**Input**: Design documents from `/specs/006-remotion-demo-backup/`  
**Prerequisites**: `plan.md` (required), `spec.md` (required for user stories), `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: No automated test tasks are included — the feature is validated by visual review of rendered video and by following the steps in `quickstart.md`.

**Organization**: Tasks are grouped by user story so each story can be implemented and validated independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialize the presenter-only Remotion project without affecting core BuildMate dependencies.

- [ ] T001 Create presenter-only `demo/video-backup/` directory and `demo/video-backup/package.json` per implementation plan
- [ ] T002 Add Remotion, React, TypeScript, Playwright, and `tsx` as dev dependencies in `demo/video-backup/package.json`
- [ ] T003 [P] Create `demo/video-backup/remotion.config.ts` with default render configuration
- [ ] T004 [P] Create `demo/video-backup/tsconfig.json` extending a TypeScript 5.x config appropriate for React

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core metadata, composition, and placeholder structure that MUST be complete before any user story can be captured or rendered.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T005 Create `demo/video-backup/src/scenes.ts` containing `SceneAsset` and `DemoVideoComposition` metadata
- [ ] T006 Implement `demo/video-backup/src/components/Caption.tsx` for optional caption overlays
- [ ] T007 Implement `demo/video-backup/src/Root.tsx` exposing the `BuildMateS1S3Demo` composition
- [ ] T008 Implement `demo/video-backup/src/components/MissingAsset.tsx` fallback for missing scene files
- [ ] T009 [P] Create `demo/video-backup/public/scenes/.gitkeep` and `demo/video-backup/out/.gitkeep`

**Checkpoint**: Foundation ready — `npx remotion studio` can launch and the composition metadata is valid.

---

## Phase 3: User Story 1 - Record the complete S1→S3 fallback demo video (Priority: P1) 🎯 MVP

**Goal**: Capture the full S1→S3 WebChat journey as separate scene assets and assemble them into a single 3–5 minute offline-playable fallback video.

**Independent Test**: A reviewer can watch `demo/video-backup/out/buildmate-s1-s3-demo.mp4` and verify that all seven required scenes are present, in order, and visually legible.

### Implementation for User Story 1

- [ ] T010 [P] [US1] Define S1→S3 capture steps in `demo/video-backup/src/capture-steps.ts`
- [ ] T011 [US1] Implement `demo/video-backup/scripts/capture-scene.ts` to record one scene from WebChat by id
- [ ] T012 [US1] Implement `demo/video-backup/scripts/capture-all.ts` orchestrating the full S1→S3 capture run
- [ ] T013 [P] [US1] Implement `demo/video-backup/src/components/ScenePlayer.tsx` to render a captured scene asset with optional caption
- [ ] T014 [US1] Implement `demo/video-backup/src/DemoVideo.tsx` main composition sequencing all scenes
- [ ] T015 [US1] Run `demo/video-backup/scripts/capture-all.ts` against local WebChat to generate `public/scenes/*.mp4`
- [ ] T016 [US1] Render final fallback video to `demo/video-backup/out/buildmate-s1-s3-demo.mp4`
- [ ] T017 [US1] Validate final video duration is 3–5 minutes and all seven scenes are present and legible

**Checkpoint**: At this point, User Story 1 is fully functional. The fallback video can be copied to the venue laptop.

---

## Phase 4: User Story 2 - Re-export the video from individual scene assets (Priority: P2)

**Goal**: Allow the presenter to reassemble or re-export the final video after changing one scene, trim, or caption, without re-recording the entire WebChat session.

**Independent Test**: The presenter can replace or trim a single scene asset, update metadata, and render a new valid final video in under 30 minutes.

### Implementation for User Story 2

- [ ] T018 [US2] Implement `demo/video-backup/scripts/update-durations.ts` to measure captured assets and rewrite `demo/video-backup/src/scenes.ts`
- [ ] T019 [US2] Document the re-export workflow in `demo/video-backup/README.md`
- [ ] T020 [US2] Verify re-export by re-capturing one scene, running `update-durations.ts`, and rendering a new final video

**Checkpoint**: User Story 2 is complete — scene-level edits and re-export work without a full re-capture.

---

## Phase 5: User Story 3 - Keep S2/S4 scenes out of the primary deliverable but appendable later (Priority: P3)

**Goal**: Keep the primary video scoped to S1→S3 while making the structure extensible for optional S2/S4 scenes later.

**Independent Test**: A placeholder S2 or S4 scene asset can be appended after the S3 scene and exported as an extended version of the same video.

### Implementation for User Story 3

- [ ] T021 [US3] Refactor `demo/video-backup/src/scenes.ts` so optional `s2-*` and `s4-*` scene ids can be appended after the `auto-add` scene
- [ ] T022 [US3] Add placeholder disabled S2/S4 scene entries in `demo/video-backup/src/scenes.ts`
- [ ] T023 [US3] Verify extended export by enabling the placeholder scenes and rendering a longer cut

**Checkpoint**: User Story 3 is complete — the composition can be extended without rebuilding the S1→S3 timeline.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final cleanup, documentation sync, and dependency isolation checks.

- [ ] T024 [P] Add `demo/video-backup/.gitignore` to exclude `out/` and large scene assets from version control
- [ ] T025 [P] Update `specs/006-remotion-demo-backup/quickstart.md` if capture/render commands or paths changed during implementation
- [ ] T026 [P] Verify `demo/video-backup/package.json` does not leak presenter dependencies into the root workspace or core packages
- [ ] T027 Run `npx remotion still` sanity check and final render validation per `quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories.
- **User Stories (Phase 3+)**: All depend on Foundational phase completion.
  - User stories can proceed in parallel if team capacity allows.
  - Or sequentially in priority order (P1 → P2 → P3).
- **Polish (Final Phase)**: Depends on all desired user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2). No dependencies on other stories. This is the MVP.
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) and after US1 capture scripts exist. It does not require the final video to be rendered.
- **User Story 3 (P3)**: Can start after Foundational (Phase 2). It only touches metadata structure and can be verified with placeholder assets.

### Within Each User Story

- Metadata/contracts before capture scripts.
- Capture scripts before running capture.
- Assets generated before assembling the composition.
- Composition implemented before rendering.
- Render and visual validation mark story completion.

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel.
- All Foundational tasks marked [P] can run in parallel (within Phase 2).
- `T010 [P] [US1]` (capture steps data) and `T013 [P] [US1]` (ScenePlayer component) can run in parallel.
- Once Foundational phase completes, US1, US2, and US3 can be worked on in parallel if staffed, because they are independently testable.
- All Polish tasks marked [P] can run in parallel.

---

## Parallel Example: User Story 1

```bash
# After T005–T009 are done, launch these together:
Task: "Define S1→S3 capture steps in demo/video-backup/src/capture-steps.ts"
Task: "Implement ScenePlayer component in demo/video-backup/src/components/ScenePlayer.tsx"

# Then capture and render:
Task: "Run capture-all.ts to generate public/scenes/*.mp4"
Task: "Render final fallback video to out/buildmate-s1-s3-demo.mp4"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational.
3. Complete Phase 3: User Story 1 (capture all scenes and render the fallback video).
4. **STOP and VALIDATE**: Watch the rendered video and confirm the 3–5 minute S1→S3 narrative.
5. Copy the MP4 to the venue laptop.

### Incremental Delivery

1. Setup + Foundational → Foundation ready.
2. User Story 1 → Fallback video playable offline → MVP demo ready.
3. User Story 2 → Re-export workflow documented and tested.
4. User Story 3 → Composition structure ready for future S2/S4 extension.
5. Polish → Documentation sync and dependency isolation verified.

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together.
2. Once Foundational is done:
   - Developer A: User Story 1 (capture + render).
   - Developer B: User Story 2 (duration updater + re-export workflow).
   - Developer C: User Story 3 (extensible scene ordering).
3. Each story is validated independently before the final Polish phase.

---

## Notes

- [P] tasks = different files, no dependencies.
- [Story] label maps each task to a specific user story for traceability.
- No automated unit tests are requested; validation is visual and procedural.
- Scene assets are large binary files and should be excluded from git via `.gitignore`.
- Remotion and React are presenter-only dependencies; they must not leak into core BuildMate packages.
