import type {
  SignPoseCoordinate,
  SignPoseFrame,
  SignPoseSequence,
} from "../../../../../shared/types/signPose";

export type { SignPoseCoordinate, SignPoseFrame, SignPoseSequence };

export interface Point {
  x: number;
  y: number;
}

export type HandSide = "left" | "right";

export type FingerName = "thumb" | "index" | "middle" | "ring" | "pinky";

export type FingerChains = Partial<Record<FingerName, Point[]>>;

export interface HandPose {
  side: HandSide;
  wrist?: Point;
  palmCenter?: Point;
  palmAngle: number;
  fingers: FingerChains;
  baseThumb?: Point;
  baseIndex?: Point;
  basePinky?: Point;
}

export interface AvatarPose {
  pose: string;
  points: Record<string, Point>;
  leftHand: HandPose;
  rightHand: HandPose;
  headTilt: number;
}
