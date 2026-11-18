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

  const detailedKnuckles = FINGER_ORDER.map(
    (finger) => fingers[finger]?.[0],
  ).filter((point): point is Point => Boolean(point));
  const hasDetailedFingers = FINGER_ORDER.some(
    (finger) => (fingers[finger]?.length ?? 0) > 0,
  );
  const basePoints = [hand.baseThumb, hand.baseIndex, hand.basePinky].filter(
    (point): point is Point => Boolean(point),
  );
  const anchor = wrist ?? center;
  const scale = 1.34;

  const palmPath =
    wrist && detailedKnuckles.length >= 3
      ? [
          `M ${wrist.x} ${wrist.y}`,
          ...detailedKnuckles.map((point) => `L ${point.x} ${point.y}`),
          "Z",
        ].join(" ")
      : null;

  return (
    <g
      transform={`translate(${anchor.x} ${anchor.y}) scale(${scale}) translate(${-anchor.x} ${-anchor.y})`}
    >
      {palmPath ? (
        <path
          d={palmPath}
          fill={AVATAR_COLORS.skin}
          stroke={AVATAR_COLORS.skinShade}
          strokeWidth={1.3}
          strokeLinejoin="round"
        />
      ) : (
        <ellipse
          cx={center.x}
          cy={center.y}
          rx={avatarSizes.palmRx}
          ry={avatarSizes.palmRy}
          fill={AVATAR_COLORS.skin}
          stroke={AVATAR_COLORS.skinShade}
          strokeWidth={1.2}
          transform={`rotate(${palmAngle - 90} ${center.x} ${center.y})`}
        />
      )}

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
                strokeWidth={width + 3.4}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                opacity={0.3}
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
            (fingers[finger] ?? []).map((point, index, chain) => (
              <circle
                key={`joint-${finger}-${index}`}
                cx={point.x}
                cy={point.y}
                r={
                  index === chain.length - 1
                    ? 1.7
                    : finger === "thumb"
                      ? 1.5
                      : 1.3
                }
                fill="#F6D9C4"
                stroke={AVATAR_COLORS.purple}
                strokeWidth={0.6}
              />
            )),
          )}
        </>
      ) : basePoints.length > 0 ? (
        <>
          {basePoints.map((point, index) => (
            <g key={`base-${index}`}>
              <path
                d={`M ${center.x} ${center.y} L ${point.x} ${point.y}`}
                stroke={AVATAR_COLORS.skinShade}
                strokeWidth={
                  (index === 0 ? avatarSizes.thumb : avatarSizes.finger) + 3
                }
                strokeLinecap="round"
                opacity={0.28}
                fill="none"
              />
              <path
                d={`M ${center.x} ${center.y} L ${point.x} ${point.y}`}
                stroke={AVATAR_COLORS.skin}
                strokeWidth={
                  index === 0 ? avatarSizes.thumb : avatarSizes.finger
                }
                strokeLinecap="round"
                fill="none"
              />
              <circle
                cx={point.x}
                cy={point.y}
                r={1.6}
                fill="#F6D9C4"
                stroke={AVATAR_COLORS.purple}
                strokeWidth={0.6}
              />
            </g>
          ))}
        </>
      ) : null}

      {wrist ? (
        <circle
          cx={wrist.x}
          cy={wrist.y}
          r={avatarSizes.forearm / 2}
          fill={AVATAR_COLORS.skin}
          stroke={AVATAR_COLORS.skinShade}
          strokeWidth={0.7}
        />
      ) : null}
    </g>
  );
}
