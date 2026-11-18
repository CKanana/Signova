import type {
  AvatarPose,
  FingerChains,
  FingerName,
  HandPose,
  HandSide,
  Point,
  SignPoseFrame,
  SignPoseSequence,
} from "./avatar.types";

export const AVATAR_VIEW = {
  width: 420,
  height: 380,
  padding: 22,
  xMin: -0.5,
  xMax: 0.5,
  yMin: -0.35,
  yMax: 0.8,
} as const;

const FINGER_JOINTS: Record<FingerName, string[]> = {
  thumb: ["cmc", "mcp", "ip", "tip"],
  index: ["mcp", "pip", "dip", "tip"],
  middle: ["mcp", "pip", "dip", "tip"],
  ring: ["mcp", "pip", "dip", "tip"],
  pinky: ["mcp", "pip", "dip", "tip"],
};

export type MappedFrame = {
  pose: string;
  points: Record<string, Point>;
};

function mapNormalized(x: number, y: number, centerX: number): Point {
  const innerWidth = AVATAR_VIEW.width - AVATAR_VIEW.padding * 2;
  const innerHeight = AVATAR_VIEW.height - AVATAR_VIEW.padding * 2;
  const xRatio =
    (x - centerX - AVATAR_VIEW.xMin) / (AVATAR_VIEW.xMax - AVATAR_VIEW.xMin);
  const yRatio = (y - AVATAR_VIEW.yMin) / (AVATAR_VIEW.yMax - AVATAR_VIEW.yMin);
  return {
    x: AVATAR_VIEW.padding + xRatio * innerWidth,
    y: AVATAR_VIEW.padding + yRatio * innerHeight,
  };
}

function rawPoints(
  frame: SignPoseFrame,
  joints: string[],
): Record<string, Point> {
  const points: Record<string, Point> = {};
  joints.forEach((name, index) => {
    const x = frame.p[index * 2];
    const y = frame.p[index * 2 + 1];
    if (typeof x === "number" && typeof y === "number") {
      points[name] = { x, y };
    }
  });
  return points;
}

function rawCenterX(frame: SignPoseFrame, joints: string[]): number {
  const points = rawPoints(frame, joints);
  const leftHip = points.left_hip;
  const rightHip = points.right_hip;
  if (leftHip && rightHip) return (leftHip.x + rightHip.x) / 2;
  const leftShoulder = points.left_shoulder;
  const rightShoulder = points.right_shoulder;
  if (leftShoulder && rightShoulder) {
    return (leftShoulder.x + rightShoulder.x) / 2;
  }
  return 0;
}

export function buildMappedFrames(pose: SignPoseSequence): MappedFrame[] {
  const first = pose.frames[0];
  if (!first) return [];
  const centerX = rawCenterX(first, pose.joints);

  return pose.frames.map((frame) => {
    const source = rawPoints(frame, pose.joints);
    const points: Record<string, Point> = {};
    Object.entries(source).forEach(([name, point]) => {
      points[name] = mapNormalized(point.x, point.y, centerX);
    });
    return { pose: frame.pose, points };
  });
}

function average(points: Point[]): Point | undefined {
  if (points.length === 0) return undefined;
  let x = 0;
  let y = 0;
  for (const point of points) {
    x += point.x;
    y += point.y;
  }
  return { x: x / points.length, y: y / points.length };
}

function angleDegrees(from: Point, to: Point): number {
  return (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI;
}

function buildHand(
  points: Record<string, Point>,
  side: HandSide,
): HandPose {
  const wrist = points[`${side}_wrist`];
  const fingers: FingerChains = {};

  (Object.keys(FINGER_JOINTS) as FingerName[]).forEach((finger) => {
    const chain = FINGER_JOINTS[finger]
      .map((suffix) => points[`${side}_${finger}_${suffix}`])
      .filter((point): point is Point => Boolean(point));
    if (chain.length > 0) fingers[finger] = chain;
  });

  const anchor =
    points[`${side}_middle_mcp`] ??
    points[`${side}_index_mcp`] ??
    points[`${side}_index`] ??
    points[`${side}_pinky_mcp`] ??
    points[`${side}_pinky`];

  const palmSource = [
    wrist,
    points[`${side}_thumb_cmc`],
    points[`${side}_index_mcp`],
    points[`${side}_middle_mcp`],
    points[`${side}_ring_mcp`],
    points[`${side}_pinky_mcp`],
  ].filter((point): point is Point => Boolean(point));

  const palmCenter =
    average(palmSource) ??
    (wrist ? { x: wrist.x, y: wrist.y - 9 } : undefined);

  const palmAngle =
    wrist && anchor ? angleDegrees(wrist, anchor) : -90;

  return {
    side,
    wrist,
    palmCenter,
    palmAngle,
    fingers,
    baseThumb: points[`${side}_thumb`],
    baseIndex: points[`${side}_index`],
    basePinky: points[`${side}_pinky`],
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function buildAvatarPose(frame: MappedFrame): AvatarPose {
  const { points } = frame;
  const leftShoulder = points.left_shoulder;
  const rightShoulder = points.right_shoulder;
  const headTilt =
    leftShoulder && rightShoulder
      ? clamp(angleDegrees(leftShoulder, rightShoulder) * 0.18, -7, 7)
      : 0;

  return {
    pose: frame.pose,
    points,
    leftHand: buildHand(points, "left"),
    rightHand: buildHand(points, "right"),
    headTilt,
  };
}

function interpolatePoint(
  a: Point | undefined,
  b: Point | undefined,
  t: number,
): Point | undefined {
  if (a && b) {
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  }
  return a ?? b;
}

export function getAvatarPoseAt(
  frames: MappedFrame[],
  position: number,
): AvatarPose | null {
  if (frames.length === 0) return null;
  const maxIndex = frames.length - 1;
  const clamped = clamp(position, 0, maxIndex);
  const index = Math.floor(clamped);
  const nextIndex = Math.min(index + 1, maxIndex);
  const t = clamped - index;
  const current = frames[index];
  const next = frames[nextIndex];

  if (!current) return null;
  if (!next || t === 0 || current === next) return buildAvatarPose(current);

  const names = new Set([
    ...Object.keys(current.points),
    ...Object.keys(next.points),
  ]);
  const points: Record<string, Point> = {};
  names.forEach((name) => {
    const point = interpolatePoint(current.points[name], next.points[name], t);
    if (point) points[name] = point;
  });

  return buildAvatarPose({ pose: current.pose, points });
}
