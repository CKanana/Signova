import type { Point } from "./avatar.types";
import { AVATAR_COLORS, avatarSizes } from "./avatarTheme";

interface AvatarArmProps {
  shoulder?: Point;
  elbow?: Point;
  wrist?: Point;
}

function along(from: Point, to: Point, t: number): Point {
  return {
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
  };
}

export function AvatarArm({ shoulder, elbow, wrist }: AvatarArmProps) {
  if (!shoulder) return null;

  const sleeveEnd = elbow
    ? along(shoulder, elbow, 0.34)
    : wrist
      ? along(shoulder, wrist, 0.3)
      : along(shoulder, { x: shoulder.x, y: shoulder.y + 30 }, 0.6);

  return (
    <>
      {elbow ? (
        <line
          x1={shoulder.x}
          y1={shoulder.y}
          x2={elbow.x}
          y2={elbow.y}
          stroke={AVATAR_COLORS.skinShade}
          strokeWidth={avatarSizes.upperArm + 3.5}
          strokeLinecap="round"
          opacity={0.24}
        />
      ) : null}
      {elbow && wrist ? (
        <line
          x1={elbow.x}
          y1={elbow.y}
          x2={wrist.x}
          y2={wrist.y}
          stroke={AVATAR_COLORS.skinShade}
          strokeWidth={avatarSizes.forearm + 3.5}
          strokeLinecap="round"
          opacity={0.24}
        />
      ) : null}

      {elbow ? (
        <line
          x1={shoulder.x}
          y1={shoulder.y}
          x2={elbow.x}
          y2={elbow.y}
          stroke={AVATAR_COLORS.skin}
          strokeWidth={avatarSizes.upperArm}
          strokeLinecap="round"
        />
      ) : null}
      {elbow && wrist ? (
        <line
          x1={elbow.x}
          y1={elbow.y}
          x2={wrist.x}
          y2={wrist.y}
          stroke={AVATAR_COLORS.skin}
          strokeWidth={avatarSizes.forearm}
          strokeLinecap="round"
        />
      ) : null}

      <line
        x1={shoulder.x}
        y1={shoulder.y}
        x2={sleeveEnd.x}
        y2={sleeveEnd.y}
        stroke={AVATAR_COLORS.shirtLight}
        strokeWidth={avatarSizes.sleeve}
        strokeLinecap="round"
      />
      {elbow ? (
        <circle
          cx={elbow.x}
          cy={elbow.y}
          r={avatarSizes.forearm / 2}
          fill={AVATAR_COLORS.skin}
          stroke={AVATAR_COLORS.skinShade}
          strokeWidth={0.6}
        />
      ) : null}
    </>
  );
}


