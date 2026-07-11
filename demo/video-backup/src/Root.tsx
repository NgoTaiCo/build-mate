import React from "react";
import { Composition } from "remotion";
import { DemoVideo } from "./DemoVideo";
import { COMPOSITION } from "./scenes";

/**
 * Root Remotion entry point.
 * Registers the BuildMateS1S3Demo composition with metadata derived from
 * the scenes.ts metadata file — no hard-coded frame counts here.
 */
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id={COMPOSITION.id}
        component={DemoVideo}
        durationInFrames={COMPOSITION.scenes.reduce(
          (acc: number, s: { durationInFrames: number }) => acc + s.durationInFrames,
          0
        )}
        fps={COMPOSITION.fps}
        width={COMPOSITION.width}
        height={COMPOSITION.height}
        defaultProps={{
          captionsEnabled: COMPOSITION.captionsEnabled,
        }}
      />
    </>
  );
};
