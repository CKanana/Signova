import type { Point } from "./avatar.types";
import { AVATAR_COLORS, avatarSizes } from "./avatarTheme";

interface AvatarBodyProps {
  points: Record<string, Point>;
}

function mid(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export function AvatarBody({ points }: AvatarBodyProps) {
  const nose = points.nose;
  const rawLeftShoulder = points.left_shoulder;
  const rawRightShoulder = points.right_shoulder;
  if (!rawLeftShoulder || !rawRightShoulder) return null;

  const leftShoulder =
    rawLeftShoulder.x <= rawRightShoulder.x ? rawLeftShoulder : rawRightShoulder;
  const rightShoulder =
    rawLeftShoulder.x <= rawRightShoulder.x ? rawRightShoulder : rawLeftShoulder;

  const shoulderMid = mid(leftShoulder, rightShoulder);
  const rawLeftHip = points.left_hip ?? {
    x: shoulderMid.x - 40,
    y: shoulderMid.y + 116,
  };
  const rawRightHip = points.right_hip ?? {
    x: shoulderMid.x + 40,
    y: shoulderMid.y + 116,
  };
  const leftHip = rawLeftHip.x <= rawRightHip.x ? rawLeftHip : rawRightHip;
  const rightHip = rawLeftHip.x <= rawRightHip.x ? rawRightHip : rawLeftHip;
  const hipMid = mid(leftHip, rightHip);
  const hipHalfWidth = Math.max(
    34,
    Math.abs(rightHip.x - leftHip.x) / 2 + 8,
  );

  const shoulderLeft = { x: leftShoulder.x - 7, y: leftShoulder.y - 2 };
  const shoulderRight = { x: rightShoulder.x + 7, y: rightShoulder.y - 2 };
  const hipLeft = { x: hipMid.x - hipHalfWidth, y: leftHip.y + 3 };
  const hipRight = { x: hipMid.x + hipHalfWidth, y: rightHip.y + 3 };

  const neckTop = nose
    ? { x: nose.x, y: nose.y + avatarSizes.headRadiusY * 0.72 }
    : { x: shoulderMid.x, y: shoulderMid.y - 34 };
  const neckHalf = avatarSizes.neckWidth / 2;

  const torsoPath = [
    `M ${shoulderLeft.x} ${shoulderLeft.y}`,
    `Q ${shoulderMid.x} ${shoulderMid.y - 13} ${shoulderRight.x} ${shoulderRight.y}`,
    `C ${shoulderRight.x + 8} ${shoulderRight.y + 35} ${hipRight.x + 4} ${hipRight.y - 28} ${hipRight.x} ${hipRight.y}`,
    `Q ${hipMid.x} ${hipMid.y + 10} ${hipLeft.x} ${hipLeft.y}`,
    `C ${hipLeft.x - 4} ${hipLeft.y - 28} ${shoulderLeft.x - 8} ${shoulderLeft.y + 35} ${shoulderLeft.x} ${shoulderLeft.y}`,
    "Z",
  ].join(" ");

  const collarPath = [
    `M ${shoulderMid.x - 17} ${shoulderMid.y - 3}`,
    `Q ${shoulderMid.x} ${shoulderMid.y + 13} ${shoulderMid.x + 17} ${shoulderMid.y - 3}`,
    `Q ${shoulderMid.x} ${shoulderMid.y + 4} ${shoulderMid.x - 17} ${shoulderMid.y - 3}`,
    "Z",
  ].join(" ");

  const badgeY = shoulderMid.y + Math.max(42, (hipMid.y - shoulderMid.y) * 0.36);

  return (
    <>
      <path
        d={[
          `M ${neckTop.x - neckHalf} ${neckTop.y}`,
          `Q ${neckTop.x - neckHalf - 1} ${shoulderMid.y - 2} ${shoulderMid.x - 9} ${shoulderMid.y + 3}`,
          `L ${shoulderMid.x + 9} ${shoulderMid.y + 3}`,
          `Q ${neckTop.x + neckHalf + 1} ${shoulderMid.y - 2} ${neckTop.x + neckHalf} ${neckTop.y}`,
          "Z",
        ].join(" ")}
        fill={AVATAR_COLORS.skin}
        stroke={AVATAR_COLORS.skinShade}
        strokeWidth={0.8}
      />
      <path
        d={torsoPath}
        fill={AVATAR_COLORS.shirt}
        stroke={AVATAR_COLORS.shirtDark}
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
      <path d={collarPath} fill={AVATAR_COLORS.collar} opacity={0.95} />
      <circle
        cx={shoulderMid.x}
        cy={badgeY}
        r={11}
        fill={AVATAR_COLORS.badge}
        opacity={0.96}
      />
      <text
        x={shoulderMid.x}
        y={badgeY + 3.6}
        fontSize={10}
        fontWeight="800"
        fill={AVATAR_COLORS.shirt}
        textAnchor="middle"
      >
        S
      </text>
    </>
  );
}



