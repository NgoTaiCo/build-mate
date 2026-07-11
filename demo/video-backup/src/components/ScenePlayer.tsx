import React from "react";
import { OffthreadVideo, staticFile, useVideoConfig } from "remotion";
import { Caption } from "./Caption";
import { MissingAsset } from "./MissingAsset";
import type { SceneAsset } from "../types";

interface ScenePlayerProps {
  scene: SceneAsset;
  /** Whether to show caption overlay (inherits from composition config) */
  captionsEnabled?: boolean;
  /** Whether the asset file actually exists (determined at render time by caller) */
  assetExists?: boolean;
}

/**
 * Renders a single captured scene asset with an optional caption overlay.
 * Falls back to <MissingAsset> when the mp4 file has not been captured yet.
 */
export const ScenePlayer: React.FC<ScenePlayerProps> = ({
  scene,
  captionsEnabled = true,
  assetExists = true,
}) => {
  const { width, height } = useVideoConfig();

  if (!assetExists) {
    return <MissingAsset sceneId={scene.id} title={scene.title} />;
  }

  return (
    <div style={{ width, height, position: "relative", background: "#000" }}>
      <OffthreadVideo
        src={staticFile(`scenes/${scene.src}`)}
        style={{ width, height, objectFit: "contain" }}
      />
      {captionsEnabled && scene.caption && (
        <Caption text={scene.caption} fadeInAt={10} fadeInDuration={20} />
      )}
    </div>
  );
};
