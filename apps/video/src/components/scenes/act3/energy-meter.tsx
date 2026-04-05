import { SceneContainer } from "@/components/scene-container";
import { SceneHeadline } from "@/components/scene-headline";
import { entryScale } from "@/lib/animation";
import { COLORS } from "@/lib/constants";
import { Easing, interpolate, useCurrentFrame } from "remotion";

const ARC_CIRCUMFERENCE = Math.PI * 64;

/**
 * "Miss a day?" (instant, bold)
 * → "Your energy dips a little." (word by word, muted)
 * → small gauge showing 78 → 76.
 *
 * The concept scene — one question, one answer, one visual proof.
 */
export function EnergyIntro() {
  const frame = useCurrentFrame();

  const gaugeStyle = entryScale({ frame, delay: 50, duration: 12 });
  const energyValue = interpolate(frame, [55, 75], [78, 76], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.quad),
  });
  const arcFraction = energyValue / 100;
  const arcDashoffset = ARC_CIRCUMFERENCE * (1 - arcFraction);

  return (
    <SceneContainer bg="white">
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 28,
        }}
      >
        <SceneHeadline
          setup="Miss a day?"
          payoff="Your energy dips a little."
          fontSize={44}
        />

        {/* Small gauge — secondary to text */}
        <div style={{ ...gaugeStyle, position: "relative", width: 140, height: 88 }}>
          <svg width={140} height={88} viewBox="0 0 140 88">
            <path
              d="M 14 74 A 56 56 0 0 1 126 74"
              fill="none"
              stroke={COLORS.border}
              strokeWidth={6}
              strokeLinecap="round"
            />
            <path
              d="M 14 74 A 56 56 0 0 1 126 74"
              fill="none"
              stroke={COLORS.energy}
              strokeWidth={6}
              strokeLinecap="round"
              strokeDasharray={ARC_CIRCUMFERENCE}
              strokeDashoffset={arcDashoffset}
            />
          </svg>
          <div
            style={{
              position: "absolute",
              top: 28,
              left: 0,
              right: 0,
              display: "flex",
              justifyContent: "center",
            }}
          >
            <span
              style={{
                fontSize: 36,
                fontWeight: 700,
                color: COLORS.energy,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {Math.round(energyValue)}
            </span>
          </div>
        </div>
      </div>
    </SceneContainer>
  );
}

/**
 * "But it doesn't disappear." (instant, bold)
 * → "It bounces right back." (word by word, muted)
 *
 * Short, punchy. The relief.
 */
export function EnergyNeverGone() {
  return (
    <SceneContainer bg="white">
      <SceneHeadline
        setup="But it doesn't disappear."
        payoff="It bounces right back."
        payoffStartFrame={20}
        fontSize={44}
      />
    </SceneContainer>
  );
}

/**
 * "No guilt. No punishment." (instant, bold)
 * → "Just pick up where you left off." (word by word, muted)
 *
 * The emotional payoff.
 */
export function EnergyPhilosophy() {
  return (
    <SceneContainer bg="white">
      <SceneHeadline
        setup="No guilt. No punishment."
        payoff="Just pick up where you left off."
        fontSize={44}
      />
    </SceneContainer>
  );
}
