import type { Point } from "./avatar.types";
import { AVATAR_COLORS, avatarSizes } from "./avatarTheme";
import { AvatarFace } from "./AvatarFace";

interface AvatarHeadProps {
  center?: Point;
  tilt: number;
}

export function AvatarHead({ center, tilt }: AvatarHeadProps) {
  if (!center) return null;
  const { x: cx, y: cy } = center;
  const rx = avatarSizes.headRadius;
  const ry = avatarSizes.headRadiusY;

  return (
    <g transform={`rotate(${tilt} ${cx} ${cy})`}>
      <ellipse
        cx={cx}
        cy={cy - 2}
        rx={rx + 5}
        ry={ry + 6}
        fill={AVATAR_COLORS.hair}
      />
      <circle
        cx={cx - rx + 1}
        cy={cy + 5}
        r={5.5}
        fill={AVATAR_COLORS.skin}
        stroke={AVATAR_COLORS.skinShade}
        strokeWidth={1}
      />
      <circle
        cx={cx + rx - 1}
        cy={cy + 5}
        r={5.5}
        fill={AVATAR_COLORS.skin}
        stroke={AVATAR_COLORS.skinShade}
        strokeWidth={1}
      />
      <ellipse
        cx={cx}
        cy={cy + 2}
        rx={rx}
        ry={ry}
        fill={AVATAR_COLORS.skin}
        stroke={AVATAR_COLORS.skinShade}
        strokeWidth={0.8}
      />
      <path
        d={[
          `M ${cx - rx - 4} ${cy - 2}`,
          `Q ${cx - 29} ${cy - 34} ${cx - 1} ${cy - 36}`,
          `Q ${cx + 24} ${cy - 36} ${cx + rx + 3} ${cy - 9}`,
          `Q ${cx + 15} ${cy - 18} ${cx + 4} ${cy - 15}`,
          `Q ${cx - 4} ${cy - 23} ${cx - 14} ${cy - 13}`,
          `Q ${cx - 24} ${cy - 13} ${cx - rx - 4} ${cy - 2}`,
          "Z",
        ].join(" ")}
        fill={AVATAR_COLORS.hair}
      />
      <path
        d={`M ${cx - 25} ${cy - 17} Q ${cx - 16} ${cy - 27} ${cx - 4} ${cy - 26}`}
        stroke={AVATAR_COLORS.hairLight}
        strokeWidth={2.4}
        strokeLinecap="round"
        fill="none"
      />
      <AvatarFace center={center} tilt={0} />
    </g>
  );
}


