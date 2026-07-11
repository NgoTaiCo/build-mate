import React from "react";
import { AbsoluteFill, Series } from "remotion";
import { ScenePlayer } from "./components/ScenePlayer";
import { IntroScene } from "./scenes/IntroScene";
import { ORDERED_SCENES } from "./scenes";

interface DemoVideoProps {
  captionsEnabled?: boolean;
}

/**
 * Main S1→S3 composition.
 *
 * Scenes:
 *   1. IntroScene  — Remotion-generated title card (150 frames)
 *   2-7. WebChat captures via ScenePlayer (served from public/scenes/)
 *
 * When a WebChat scene asset is missing from public/scenes/, ScenePlayer
 * renders the MissingAsset fallback with the capture command.
 */
export const DemoVideo: React.FC<DemoVideoProps> = ({
  captionsEnabled = true,
}) => {
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Series>
        {ORDERED_SCENES.map((scene) => {
          // Intro is Remotion-generated — no asset file needed
          if (scene.id === "intro") {
            return (
              <Series.Sequence
                key={scene.id}
                durationInFrames={scene.durationInFrames}
                name={scene.title}
              >
                <IntroScene />
              </Series.Sequence>
            );
          }

          return (
            <Series.Sequence
              key={scene.id}
              durationInFrames={scene.durationInFrames}
              name={scene.title}
            >
              <ScenePlayer
                scene={scene}
                captionsEnabled={captionsEnabled}
                // Set assetExists=false to show placeholder instead of erroring
                // when the mp4 has not been captured yet.
                assetExists={true}
              />
            </Series.Sequence>
          );
        })}
      </Series>
    </AbsoluteFill>
  );
};
