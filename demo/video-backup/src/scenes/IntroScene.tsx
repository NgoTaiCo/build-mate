import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
  Easing,
} from "remotion";

/**
 * Opening title card — fully Remotion-generated, no captured asset needed.
 * Duration: 150 frames (5s at 30fps) from scenes.ts.
 */
export const IntroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const logoOpacity = interpolate(frame, [0, 30], [0, 1], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.ease),
  });

  const titleY = interpolate(frame, [15, 45], [40, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.back(1.2)),
  });

  const titleOpacity = interpolate(frame, [15, 45], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const subtitleOpacity = interpolate(frame, [40, 70], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const taglineOpacity = interpolate(frame, [70, 100], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Fade out near the end
  const exitOpacity = interpolate(frame, [120, 150], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(135deg, #0f0c29 0%, #1a1a3e 50%, #0f0c29 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 24,
        opacity: exitOpacity,
        fontFamily: "'Segoe UI', 'Inter', 'Arial', sans-serif",
      }}
    >
      {/* Logo icon */}
      <div
        style={{
          opacity: logoOpacity,
          width: 120,
          height: 120,
          borderRadius: 28,
          background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 64,
          boxShadow: "0 0 60px rgba(99, 102, 241, 0.5)",
          marginBottom: 8,
        }}
      >
        🔧
      </div>

      {/* Product name */}
      <div
        style={{
          opacity: titleOpacity,
          transform: `translateY(${titleY}px)`,
          fontSize: 72,
          fontWeight: 800,
          color: "#ffffff",
          letterSpacing: -1,
        }}
      >
        BuildMate
      </div>

      {/* Subtitle */}
      <div
        style={{
          opacity: subtitleOpacity,
          fontSize: 28,
          fontWeight: 400,
          color: "#a78bfa",
          letterSpacing: 2,
          textTransform: "uppercase",
        }}
      >
        AI PC Build Compiler
      </div>

      {/* Tagline */}
      <div
        style={{
          opacity: taglineOpacity,
          fontSize: 22,
          color: "rgba(255,255,255,0.6)",
          marginTop: 16,
          textAlign: "center",
          maxWidth: 600,
          lineHeight: 1.5,
        }}
      >
        Demo: S1 Find & Compile → S3 Detect & Repair
        <br />
        <span style={{ color: "#64748b", fontSize: 18 }}>
          Phong Vu Hackathon 2026
        </span>
      </div>

      {/* Bottom bar */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          width,
          height: 4,
          background: "linear-gradient(90deg, #6366f1, #8b5cf6, #a78bfa, #6366f1)",
          opacity: subtitleOpacity,
        }}
      />
    </AbsoluteFill>
  );
};
