# Feature Specification: Demo Video Backup for S1–S3 WebChat Journey

**Feature Branch**: `006-remotion-demo-backup`  
**Created**: 2026-07-07  
**Status**: Draft  
**Input**: User description: "Record demo video backup of full S1→S3 journey in WebChat for day-2 fallback when network weak at venue. Video covers: user asks for PC gaming 25M → search → compile → user picks broken build → detect errors → repair → auto-add. ~3-5 minutes. Out-of-scope: live demo setup, S2/S4 scenes (stretch only). And I want to use Remotion to make demo video, please assure everything could have that Remotion package in https://github.com/remotion-dev/remotion (this package is required in the last phase and only the presenter need it)"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Record the complete S1→S3 fallback demo video (Priority: P1)

The presenter needs a pre-recorded video that demonstrates the full BuildMate S1→S3 journey inside WebChat. The narrative starts with a shopper asking for a 25M VND gaming PC, continues through component search and build compilation, then shows the shopper selecting a deliberately broken build, the system detecting compatibility errors, the repair workflow producing a corrected build, and the corrected components being added automatically.

**Why this priority**: This is the primary day-2 fallback. If the venue network is unstable, the team can still show a complete, credible demo without relying on a live WebChat connection.

**Independent Test**: A reviewer can watch the final video file and verify that all seven required scenes are present, in order, and visually legible.

**Acceptance Scenarios**:

1. **Given** the WebChat environment is running with sample catalog data, **When** the presenter records the first scene, **Then** the recording shows the user typing a request equivalent to "PC gaming 25M" and the system acknowledging it.
2. **Given** the search scene is complete, **When** the presenter triggers compilation, **Then** the recording shows at least one complete build candidate being returned.
3. **Given** a build candidate is on screen, **When** the presenter selects the deliberately broken configuration, **Then** the recording shows visible compatibility error identifiers and messages.
4. **Given** errors are displayed, **When** the repair workflow runs, **Then** the recording shows a corrected build and the corrected components being added automatically.

---

### User Story 2 - Re-export the video from individual scene assets (Priority: P2)

The presenter must be able to reassemble or re-export the final video from separate scene assets, so that last-minute timing, captions, or ordering changes can be applied without re-recording the entire WebChat session.

**Why this priority**: Demo scripts often change right before the event. Having reusable scene assets reduces the cost of late edits and keeps the video aligned with the live narrative.

**Independent Test**: The presenter can move, trim, or replace a single scene asset and regenerate a valid final video that still covers the S1→S3 journey.

**Acceptance Scenarios**:

1. **Given** all scene assets are stored in a known location, **When** the presenter updates one asset and re-exports, **Then** the new final video is produced without re-recording unchanged scenes.
2. **Given** the presenter needs a shorter cut, **When** a non-critical scene is trimmed, **Then** the remaining scenes still form a coherent S1→S3 narrative.

---

### User Story 3 - Keep S2/S4 scenes out of the primary deliverable but appendable later (Priority: P3)

The primary video is scoped to S1→S3 only. The structure should still allow S2 and S4 scenes to be added after S3 if they become stretch-demo goals later.

**Why this priority**: This keeps the hackathon MVP bounded while preserving the option to extend the demo without rebuilding the fallback video from scratch.

**Independent Test**: A new S2 or S4 scene asset can be inserted after the S3 scene and exported as an extended version of the same video.

**Acceptance Scenarios**:

1. **Given** the primary S1→S3 video is finalized, **When** an S2 or S4 scene asset is provided, **Then** it can be appended after the S3 scene without modifying earlier scene timings.

---

### Edge Cases

- **Recording interruption**: If a recording fails mid-scene, the presenter must be able to restart from the affected scene without re-recording completed scenes.
- **WebChat latency during recording**: The presenter may pause or use pre-staged responses so the video stays within the 3–5 minute target.
- **Broken build does not trigger errors**: A backup incompatible configuration must be ready so the error/repair scene can still be captured deterministically.
- **Final export exceeds 5 minutes**: The scene list must include optional trims so the presenter can bring the final cut back into the 3–5 minute range.
- **Venue has no internet**: The final video file must be copied locally and playable offline on a standard laptop.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The demo video MUST cover the full S1→S3 WebChat journey in this order: user request for a 25M VND gaming PC, component search, build compilation, selection of a broken build, error detection, repair, and automatic addition of the corrected components.
- **FR-002**: The final video MUST have a total duration between 3 and 5 minutes.
- **FR-003**: The final video file MUST be playable offline on a standard laptop without requiring an internet connection.
- **FR-004**: Each required scene MUST be captured from the WebChat user interface using representative sample catalog data.
- **FR-005**: The error/repair scene MUST display deterministic compatibility error identifiers and the resulting corrected build state.
- **FR-006**: Scene assets MUST be stored separately so the presenter can reassemble or re-export the final video without re-recording the entire journey.
- **FR-007**: S2 and S4 scenes MUST NOT be included in the primary deliverable; they MAY be appended later as optional stretch content.
- **FR-008**: The presenter MAY use a programmatic video composition tool to assemble scene assets; the core BuildMate application and end users MUST NOT depend on that tool.

### Key Entities _(include if feature involves data)_

- **Demo Video**: The final compiled fallback video used at the venue.
- **Scene Asset**: A short recording representing one step in the S1→S3 journey (e.g., search, compile, repair).
- **Build Configuration**: The sample parts list used during the compilation and repair scenes.
- **Error/Repair Pair**: A detected compatibility error and its corresponding corrected build state.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Venue staff can play the fallback video offline on a standard laptop.
- **SC-002**: The video completes the S1→S3 narrative in under 5 minutes and no less than 3 minutes.
- **SC-003**: All seven required scenes (request, search, compile, broken-build selection, error detection, repair, auto-add) are visible, in the correct order, and legible on a standard HD screen.
- **SC-004**: A viewer unfamiliar with BuildMate can follow the demo narrative without live presenter narration.
- **SC-005**: The presenter can produce a revised final cut within 30 minutes when only scene timing or ordering changes are required.

## Assumptions and Constraints

- The WebChat environment is available locally with sample catalog data capable of producing a 25M VND gaming PC build.
- A deliberately incompatible component selection is prepared in advance so the error/repair scene can be captured deterministically.
- The final video is intended for standard HD playback (1920x1080) on a venue laptop.
- The presenter-side composition tool is used only for final assembly and is not a runtime dependency of BuildMate, the WebChat channel, or any end-user workflow.
