import React from "react";
import { useVideoConfig } from "remotion";

interface MissingAssetProps {
  sceneId: string;
  title: string;
}

/**
 * Fallback placeholder rendered when a scene asset file is not yet captured.
 * Shows a dark card with the scene id and a "RUN CAPTURE" reminder.
 */
export const MissingAsset: React.FC<MissingAssetProps> = ({ sceneId, title }) => {
  const { width, height } = useVideoConfig();

  return (
    <div
      style={{
        width,
        height,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 100%)",
        fontFamily: "'Segoe UI', 'Arial', sans-serif",
        gap: 16,
      }}
    >
      {/* BuildMate logo mark */}
      <div
        style={{
          width: 80,
          height: 80,
          borderRadius: 20,
          background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 40,
          marginBottom: 8,
        }}
      >
        🔧
      </div>

      <div
        style={{
          color: "#a78bfa",
          fontSize: 14,
          fontWeight: 700,
          letterSpacing: 3,
          textTransform: "uppercase",
        }}
      >
        Scene Asset Missing
      </div>

      <div
        style={{
          color: "#ffffff",
          fontSize: 36,
          fontWeight: 600,
          textAlign: "center",
          maxWidth: 800,
        }}
      >
        {title}
      </div>

      <div
        style={{
          background: "rgba(99, 102, 241, 0.15)",
          border: "1px solid rgba(99, 102, 241, 0.4)",
          borderRadius: 8,
          padding: "12px 24px",
          marginTop: 8,
        }}
      >
        <code
          style={{
            color: "#a5f3fc",
            fontSize: 18,
            fontFamily: "'Cascadia Code', 'Consolas', monospace",
          }}
        >
          npx tsx scripts/capture-scene.ts {sceneId}
        </code>
      </div>

      <div
        style={{
          color: "#64748b",
          fontSize: 16,
          marginTop: 4,
        }}
      >
        Run the command above to capture this scene from WebChat
      </div>
    </div>
  );
};
