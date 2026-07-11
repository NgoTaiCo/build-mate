/**
 * Scene and composition types — local copy matching
 * specs/006-remotion-demo-backup/contracts/scene-contract.ts
 *
 * Kept in sync manually. Source of truth is the spec contract file.
 */

export interface SceneAsset {
  /** Unique scene identifier, e.g. "search" or "repair". */
  id: string;
  /** Human-readable title used for captions and Studio navigation. */
  title: string;
  /** Filename of the captured asset under the public scenes folder. */
  src: string;
  /** Scene length in frames at the composition fps. */
  durationInFrames: number;
  /** Frame at which the scene starts in the final composition. */
  startFrame: number;
  /** Optional short caption overlay shown while the scene plays. */
  caption?: string;
}

export interface DemoVideoComposition {
  /** Composition identifier, e.g. "BuildMateS1S3Demo". */
  id: string;
  /** Frames per second. */
  fps: number;
  /** Canvas width in pixels. */
  width: number;
  /** Canvas height in pixels. */
  height: number;
  /** Ordered list of scenes that form the demo narrative. */
  scenes: SceneAsset[];
  /** Whether caption overlays are rendered. */
  captionsEnabled: boolean;
}
