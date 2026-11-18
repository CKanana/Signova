import type { AvatarPose } from "./avatar.types";
import { AVATAR_COLORS, AVATAR_VIEWBOX } from "./avatarTheme";
import { AvatarArm } from "./AvatarArm";
import { AvatarBody } from "./AvatarBody";
import { AvatarHand } from "./AvatarHand";
import { AvatarHead } from "./AvatarHead";

interface SignovaAvatarProps {
  pose: AvatarPose;
}

export function SignovaAvatar({ pose }: SignovaAvatarProps) {
  const { points, leftHand, rightHand, headTilt } = pose;
  const leftHip = points.left_hip;
  const rightHip = points.right_hip;
  const leftShoulder = points.left_shoulder;
  const rightShoulder = points.right_shoulder;

  const floorY =
    (leftHip?.y ?? leftShoulder?.y ?? 310) +
    (rightHip?.y ?? rightShoulder?.y ?? 310);
  const floorCenterX =
    ((leftHip?.x ?? leftShoulder?.x ?? 210) +
      (rightHip?.x ?? rightShoulder?.x ?? 210)) /
    2;

  return (
    <svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${AVATAR_VIEWBOX.width} ${AVATAR_VIEWBOX.height}`}
      preserveAspectRatio="xMidYMid meet"
    >
      <g>
        <ellipse
          cx={floorCenterX}
          cy={Math.min(floorY / 2 + 28, AVATAR_VIEWBOX.height - 20)}
          rx={82}
          ry={13}
          fill={AVATAR_COLORS.shadow}
          opacity={0.12}
        />
        <ellipse
          cx={AVATAR_VIEWBOX.width / 2}
          cy={AVATAR_VIEWBOX.height / 2 - 8}
          rx={176}
          ry={168}
          fill={AVATAR_COLORS.purpleSoft}
          opacity={0.45}
        />
        <AvatarBody points={points} />
        <AvatarHead center={points.nose} tilt={headTilt} />
        <AvatarArm
          shoulder={points.left_shoulder}
          elbow={points.left_elbow}
          wrist={points.left_wrist}
        />
        <AvatarArm
          shoulder={points.right_shoulder}
          elbow={points.right_elbow}
          wrist={points.right_wrist}
        />
        <AvatarHand hand={leftHand} />
        <AvatarHand hand={rightHand} />
      </g>
    </svg>
  );
}


