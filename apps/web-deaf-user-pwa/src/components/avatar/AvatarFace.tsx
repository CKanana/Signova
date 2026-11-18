import type { Point } from "./avatar.types";
import { AVATAR_COLORS } from "./avatarTheme";

interface AvatarFaceProps {
  center?: Point;
  tilt: number;
}

export function AvatarFace({ center, tilt }: AvatarFaceProps) {
  if (!center) return null;
  const { x: cx, y: cy } = center;

  return (
    <g transform={`rotate(${tilt} ${cx} ${cy})`}>
      <ellipse cx={cx - 10.5} cy={cy - 2} rx={5.2} ry={4.2} fill={AVATAR_COLORS.eyeWhite} />
      <ellipse cx={cx + 10.5} cy={cy - 2} rx={5.2} ry={4.2} fill={AVATAR_COLORS.eyeWhite} />
      <circle cx={cx - 9.8} cy={cy - 1.8} r={2.2} fill={AVATAR_COLORS.eye} />
      <circle cx={cx + 11.2} cy={cy - 1.8} r={2.2} fill={AVATAR_COLORS.eye} />
      <circle cx={cx - 9} cy={cy - 2.8} r={0.7} fill={AVATAR_COLORS.eyeWhite} />
      <circle cx={cx + 12} cy={cy - 2.8} r={0.7} fill={AVATAR_COLORS.eyeWhite} />
      <path
        d={`M ${cx - 16} ${cy - 10} Q ${cx - 11} ${cy - 13} ${cx - 6} ${cy - 10.5}`}
        stroke={AVATAR_COLORS.hair}
        strokeWidth={1.9}
        strokeLinecap="round"
        fill="none"
      />
      <path
        d={`M ${cx + 6} ${cy - 10.5} Q ${cx + 11} ${cy - 13} ${cx + 16} ${cy - 10}`}
        stroke={AVATAR_COLORS.hair}
        strokeWidth={1.9}
        strokeLinecap="round"
        fill="none"
      />
      <path
        d={`M ${cx - 1} ${cy + 4} Q ${cx + 2} ${cy + 8} ${cx - 2} ${cy + 9}`}
        stroke={AVATAR_COLORS.skinShade}
        strokeWidth={1.5}
        strokeLinecap="round"
        fill="none"
      />
      <path
        d={`M ${cx - 9} ${cy + 15} Q ${cx} ${cy + 21} ${cx + 9} ${cy + 15}`}
        stroke={AVATAR_COLORS.mouth}
        strokeWidth={2.1}
        strokeLinecap="round"
        fill="none"
      />
      <circle cx={cx - 18} cy={cy + 9} r={5} fill={AVATAR_COLORS.blush} />
      <circle cx={cx + 18} cy={cy + 9} r={5} fill={AVATAR_COLORS.blush} />
    </g>
  );
}


