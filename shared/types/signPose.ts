export type SignPoseCoordinate = number | null;

export interface SignPoseFrame {
  pose: string;
  p: SignPoseCoordinate[];
}

export interface SignPoseSequence {
  status: "ok";
  text: string;
  glosses: string[];
  droppedWords: string[];
  fps: number;
  durationMs: number;
  frameCount: number;
  transitionFrames: number;
  joints: string[];
  frames: SignPoseFrame[];
  coordinateSpace: "signbridge_normalized";
  source: "signbridge";
}

export interface SignPoseResponse {
  pose: SignPoseSequence;
}
