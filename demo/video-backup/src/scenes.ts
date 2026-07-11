import type { SceneAsset, DemoVideoComposition } from "./types";

/**
 * Ordered list of S1→S3 demo scenes.
 * Update `durationInFrames` after running `scripts/update-durations.ts`
 * when scene assets are re-captured.
 *
 * Default placeholder: 300 frames = 10 s at 30 fps.
 */
export const SCENES: SceneAsset[] = [
  {
    id: "intro",
    title: "BuildMate – AI PC Build Compiler",
    src: "intro.mp4",
    durationInFrames: 150, // ~5s — title card
    startFrame: 0,
    caption: "BuildMate demo — Phong Vu Hackathon 2026",
  },
  {
    id: "search",
    title: "Khách mô tả nhu cầu: PC gaming 25M VND",
    src: "search.mp4",
    durationInFrames: 450, // ~15s
    startFrame: 0, // recalculated by DemoVideo
    caption: "S1: Khách nhập yêu cầu → hệ thống tìm kiếm linh kiện",
  },
  {
    id: "compile",
    title: "Build Compiler tổng hợp cấu hình",
    src: "compile.mp4",
    durationInFrames: 450,
    startFrame: 0,
    caption: "S1: Compiler kiểm tra compatibility → trả về build hợp lệ",
  },
  {
    id: "broken-build",
    title: "Khách chọn cấu hình lỗi",
    src: "broken-build.mp4",
    durationInFrames: 300,
    startFrame: 0,
    caption: "Khách chọn linh kiện không tương thích (demo lỗi)",
  },
  {
    id: "detect-errors",
    title: "Phát hiện lỗi tương thích",
    src: "detect-errors.mp4",
    durationInFrames: 450,
    startFrame: 0,
    caption: "S3: E001 SOCKET_MISMATCH — hệ thống phát hiện ngay",
  },
  {
    id: "repair",
    title: "Tự động sửa lỗi — Repair Workflow",
    src: "repair.mp4",
    durationInFrames: 450,
    startFrame: 0,
    caption: "S3: Repair engine thay thế CPU phù hợp socket",
  },
  {
    id: "auto-add",
    title: "Thêm linh kiện đã sửa vào giỏ hàng",
    src: "auto-add.mp4",
    durationInFrames: 300,
    startFrame: 0,
    caption: "Build hợp lệ — sẵn sàng checkout tại Phong Vu",
  },
  // --- Optional S2/S4 stretch scenes (disabled by default) ---
  // {
  //   id: "s2-compare",
  //   title: "So sánh linh kiện (S2)",
  //   src: "s2-compare.mp4",
  //   durationInFrames: 300,
  //   startFrame: 0,
  //   caption: "S2: Compare components (stretch)",
  // },
];

/**
 * Compute absolute startFrame for each scene from its position in the list.
 * Call this once to get the finalised scenes array used by the composition.
 */
export function computeStartFrames(scenes: SceneAsset[]): SceneAsset[] {
  let cursor = 0;
  return scenes.map((s) => {
    const updated = { ...s, startFrame: cursor };
    cursor += s.durationInFrames;
    return updated;
  });
}

export const ORDERED_SCENES = computeStartFrames(SCENES);

export const TOTAL_FRAMES = ORDERED_SCENES.reduce(
  (acc, s) => acc + s.durationInFrames,
  0
);

export const COMPOSITION: DemoVideoComposition = {
  id: "BuildMateS1S3Demo",
  fps: 30,
  width: 1920,
  height: 1080,
  scenes: ORDERED_SCENES,
  captionsEnabled: true,
};
