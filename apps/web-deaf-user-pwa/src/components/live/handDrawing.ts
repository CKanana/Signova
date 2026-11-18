import type { HandLandmarksPerFrame } from "../../../../../shared/types/session";

export const HAND_CONNECTIONS: ReadonlyArray<readonly [number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

const FINGERTIPS = new Set([4, 8, 12, 16, 20]);

export interface LandmarkViewport {
  cssWidth: number;
  cssHeight: number;
  videoWidth: number;
  videoHeight: number;
  mirrored: boolean;
}

export interface CanvasPoint {
  x: number;
  y: number;
}

export function mapLandmarkToCanvas(
  x: number,
  y: number,
  viewport: LandmarkViewport,
): CanvasPoint {
  const { cssWidth, cssHeight, videoWidth, videoHeight, mirrored } = viewport;
  const scale = Math.max(cssWidth / videoWidth, cssHeight / videoHeight);
  const renderedWidth = videoWidth * scale;
  const renderedHeight = videoHeight * scale;
  const offsetX = (cssWidth - renderedWidth) / 2;
  const offsetY = (cssHeight - renderedHeight) / 2;

  const px = offsetX + x * renderedWidth;
  const py = offsetY + y * renderedHeight;

  return { x: mirrored ? cssWidth - px : px, y: py };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function drawHandOverlay(
  ctx: CanvasRenderingContext2D,
  frame: HandLandmarksPerFrame | null,
  viewport: LandmarkViewport,
): void {
  if (!frame) return;

  const shortest = Math.min(viewport.cssWidth, viewport.cssHeight);
  const scale = clamp(shortest / 480, 0.8, 1.55);
  const boneOuter = 6.4 * scale;
  const boneInner = 2.6 * scale;
  const jointRadius = 4.2 * scale;
  const fingertipRadius = 5.2 * scale;
  const wristRadius = 6 * scale;

  frame.handLandmarks.forEach((hand, slot) => {
    if (!hand?.landmarks || hand.landmarks.length < 21) return;

    const points = hand.landmarks.map((point) =>
      mapLandmarkToCanvas(point.x, point.y, viewport),
    );

    const innerBone = slot === 0 ? "#F3E9FF" : "#FFF3CF";

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.strokeStyle = "rgba(96, 43, 145, 0.62)";
    ctx.lineWidth = boneOuter;
    for (const [start, end] of HAND_CONNECTIONS) {
      const a = points[start];
      const b = points[end];
      if (!a || !b) continue;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    ctx.strokeStyle = innerBone;
    ctx.lineWidth = boneInner;
    for (const [start, end] of HAND_CONNECTIONS) {
      const a = points[start];
      const b = points[end];
      if (!a || !b) continue;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    ctx.shadowColor = "rgba(40, 15, 70, 0.45)";
    ctx.shadowBlur = 6 * scale;
    ctx.strokeStyle = "#602B91";
    ctx.lineWidth = 2 * scale;

    points.forEach((point, index) => {
      const radius =
        index === 0 ? wristRadius : FINGERTIPS.has(index) ? fingertipRadius : jointRadius;
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = "#FFFFFF";
      ctx.fill();
      ctx.stroke();
    });

    ctx.restore();
  });
}
