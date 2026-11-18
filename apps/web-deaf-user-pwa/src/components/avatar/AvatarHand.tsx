import type { FingerName, HandPose, Point } from "./avatar.types";
import { AVATAR_COLORS, avatarSizes } from "./avatarTheme";

interface AvatarHandProps {
  hand: HandPose;
}

const FINGER_ORDER: FingerName[] = ["thumb", "index", "middle", "ring", "pinky"];

function fingerPath(points: Point[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) {
    return `M ${points[0].x} ${points[0].y} L ${points[0].x + 0.1} ${points[0].y}`;
  }
  return points
    .map((point, index) =>
      index === 0 ? `M ${point.x} ${point.y}` : `L ${point.x} ${point.y}`,
    )
    .join(" ");
}

export function AvatarHand({ hand }: AvatarHandProps) {
  const { wrist, palmCenter, palmAngle, fingers } = hand;
  if (!wrist && !palmCenter) return null;

  const center =
    palmCenter ?? (wrist ? { x: wrist.x, y: wrist.y - 9 } : undefined);
  if (!center) return null;

  const hasDetailedFingers = FINGER_ORDER.some(
    (finger) => (fingers[finger]?.length ?? 0) > 0,
  );

  const basePoints = [
    hand.baseThumb,
    hand.baseIndex,
    hand.basePinky,
  ].filter((point): point is Point => Boolean(point));

  return (
    <>
      {hasDetailedFingers ? (
        <>
          {FINGER_ORDER.map((finger) => {
            const chain = fingers[finger];
            if (!chain || chain.length === 0) return null;
            const width =
              finger === "thumb" ? avatarSizes.thumb : avatarSizes.finger;
            return (
              <path
                key={`outline-${finger}`}
                d={fingerPath(chain)}
                stroke={AVATAR_COLORS.skinShade}
                strokeWidth={width + 2.8}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                opacity={0.24}
              />
            );
          })}
          {FINGER_ORDER.map((finger) => {
            const chain = fingers[finger];
            if (!chain || chain.length === 0) return null;
            const width =
              finger === "thumb" ? avatarSizes.thumb : avatarSizes.finger;
            return (
              <path
                key={`finger-${finger}`}
                d={fingerPath(chain)}
                stroke={AVATAR_COLORS.skin}
                strokeWidth={width}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            );
          })}
          {FINGER_ORDER.flatMap((finger) =>
            (fingers[finger] ?? []).map((point, index) => (
              <circle
                key={`joint-${finger}-${index}`}
                cx={point.x}
                cy={point.y}
                r={finger === "thumb" ? 2.2 : 1.8}
                fill={
                  index === (fingers[finger]?.length ?? 0) - 1
                    ? AVATAR_COLORS.skinLight
                    : AVATAR_COLORS.skinShade
                }
                opacity={0.7}
              />
            )),
          )}
        </>
      ) : basePoints.length > 0 ? (
        <>
          {basePoints.map((point, index) => (
            <path
              key={`base-${index}`}
              d={`M ${center.x} ${center.y} L ${point.x} ${point.y}`}
              stroke={AVATAR_COLORS.skin}
              strokeWidth={index === 0 ? avatarSizes.thumb : avatarSizes.finger}
              strokeLinecap="round"
            />
          ))}
        </>
      ) : null}

      <ellipse
        cx={center.x}
        cy={center.y}
        rx={avatarSizes.palmRx}
        ry={avatarSizes.palmRy}
        fill={AVATAR_COLORS.skin}
        stroke={AVATAR_COLORS.skinShade}
        strokeWidth={0.8}
        transform={`rotate(${palmAngle - 90} ${center.x} ${center.y})`}
      />

      {wrist ? (
        <circle
          cx={wrist.x}
          cy={wrist.y}
          r={avatarSizes.forearm / 2}
          fill={AVATAR_COLORS.skin}
          stroke={AVATAR_COLORS.skinShade}
          strokeWidth={0.6}
        />
      ) : null}
    </>
  );
}


