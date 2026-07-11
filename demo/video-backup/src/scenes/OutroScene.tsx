import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
  Easing,
} from "remotion";

/**
 * Closing scene — Remotion-generated, not a captured WebChat asset.
 * Optional: add to SCENES array in scenes.ts if desired.
 */
export const OutroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();

  const opacity = interpolate(frame, [0, 30], [0, 1], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.ease),
  });

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(135deg, #0f0c29 0%, #1a1a3e 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 20,
        opacity,
        fontFamily: "'Segoe UI', 'Inter', 'Arial', sans-serif",
      }}
    >
      <div style={{ fontSize: 80 }}>✅</div>

      <div
        style={{
          fontSize: 52,
          fontWeight: 700,
          color: "#ffffff",
          textAlign: "center",
        }}
      >
        Build hoàn chỉnh
      </div>

      <div
        style={{
          fontSize: 24,
          color: "#a78bfa",
          textAlign: "center",
          maxWidth: 700,
          lineHeight: 1.6,
        }}
      >
        Từ yêu cầu "PC gaming 25M" →{" "}
        <span style={{ color: "#34d399" }}>cấu hình hợp lệ sẵn sàng checkout</span>
      </div>

      <div
        style={{
          marginTop: 24,
          padding: "16px 40px",
          background: "rgba(99, 102, 241, 0.15)",
          border: "1px solid rgba(99, 102, 241, 0.4)",
          borderRadius: 12,
          fontSize: 20,
          color: "rgba(255,255,255,0.7)",
          textAlign: "center",
        }}
      >
        BuildMate — phongvu.vn
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          width,
          height: 4,
          background: "linear-gradient(90deg, #6366f1, #8b5cf6, #a78bfa, #6366f1)",
        }}
      />
    </AbsoluteFill>
  );
};
