import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate, Easing } from "remotion";

interface CaptionProps {
  text: string;
  /** Frame within the scene (0-based) at which caption fades in */
  fadeInAt?: number;
  /** How many frames the fade-in takes */
  fadeInDuration?: number;
}

/**
 * Semi-transparent caption bar shown at the bottom of a scene.
 */
export const Caption: React.FC<CaptionProps> = ({
  text,
  fadeInAt = 0,
  fadeInDuration = 15,
}) => {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();

  const opacity = interpolate(
    frame,
    [fadeInAt, fadeInAt + fadeInDuration],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.ease),
    }
  );

  return (
    <div
      style={{
        position: "absolute",
        bottom: 40,
        left: 0,
        width,
        display: "flex",
        justifyContent: "center",
        opacity,
      }}
    >
      <div
        style={{
          background: "rgba(0, 0, 0, 0.65)",
          backdropFilter: "blur(4px)",
          borderRadius: 8,
          padding: "10px 28px",
          maxWidth: "80%",
          textAlign: "center",
        }}
      >
        <span
          style={{
            color: "#ffffff",
            fontSize: 28,
            fontFamily: "'Segoe UI', 'Arial', sans-serif",
            fontWeight: 500,
            lineHeight: 1.4,
            letterSpacing: 0.3,
          }}
        >
          {text}
        </span>
      </div>
    </div>
  );
};
