import { SceneContainer } from "@/components/scene-container";
import { WordReveal } from "@/components/word-reveal";
import { entryScale } from "@/lib/animation";
import { COLORS } from "@/lib/constants";
import { Easing, interpolate, useCurrentFrame } from "remotion";

const ARC_CIRCUMFERENCE = Math.PI * 80;

/**
 * "Miss a day?" (instant)
 * → "Your energy dips a little." (word by word, lighter)
 * → "But it doesn't disappear." (word by word, bold returns)
 * → "No guilt. No punishment. Just pick up where you left off." (quiet fade)
 * → arc gauge.
 */
export function EnergyMeter() {
  const frame = useCurrentFrame();

  const reasonStyle = entryScale({ frame, delay: 55, duration: 12 });
  const gaugeStyle = entryScale({ frame, delay: 72, duration: 12 });

  const energyValue = getEnergyValue(frame);
  const arcFraction = energyValue / 100;
  const arcDashoffset = ARC_CIRCUMFERENCE * (1 - arcFraction);

  return (
    <SceneContainer bg="white">
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 16,
        }}
      >
        {/* Three-line headline with word-by-word reveals */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 4,
          }}
        >
          <span style={{ fontSize: 40, fontWeight: 700, color: COLORS.text }}>Miss a day?</span>
          <WordReveal
            text="Your energy dips a little."
            startFrame={15}
            style={{ fontSize: 40, fontWeight: 400, color: COLORS.text, justifyContent: "center" }}
          />
          <WordReveal
            text="But it doesn't disappear."
            startFrame={38}
            style={{ fontSize: 40, fontWeight: 700, color: COLORS.text, justifyContent: "center" }}
          />
        </div>

        {/* Quiet philosophical closer */}
        <span
          style={{
            ...reasonStyle,
            fontSize: 22,
            fontWeight: 400,
            color: COLORS.muted,
            textAlign: "center",
          }}
        >
          No guilt. No punishment. Just pick up where you left off.
        </span>

        {/* Arc gauge */}
        <div style={{ ...gaugeStyle, position: "relative", width: 160, height: 100, marginTop: 8 }}>
          <svg width={160} height={100} viewBox="0 0 160 100">
            <path
              d="M 16 84 A 64 64 0 0 1 144 84"
              fill="none"
              stroke={COLORS.border}
              strokeWidth={7}
              strokeLinecap="round"
            />
            <path
              d="M 16 84 A 64 64 0 0 1 144 84"
              fill="none"
              stroke={COLORS.energy}
              strokeWidth={7}
              strokeLinecap="round"
              strokeDasharray={ARC_CIRCUMFERENCE}
              strokeDashoffset={arcDashoffset}
            />
          </svg>

          <div
            style={{
              position: "absolute",
              top: 32,
              left: 0,
              right: 0,
              display: "flex",
              justifyContent: "center",
            }}
          >
            <span
              style={{
                fontSize: 44,
                fontWeight: 700,
                color: COLORS.energy,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {Math.round(energyValue)}
            </span>
          </div>
        </div>

        <span style={{ ...gaugeStyle, fontSize: 14, fontWeight: 500, color: COLORS.muted }}>
          Energy Level
        </span>
      </div>
    </SceneContainer>
  );
}

/** Returns the energy value at a given frame: 78 -> 76 -> 77. */
function getEnergyValue(frame: number): number {
  if (frame < 77) return 78;

  if (frame < 107) {
    return interpolate(frame, [77, 97], [78, 76], {
      easing: Easing.inOut(Easing.quad),
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  }

  return interpolate(frame, [107, 132], [76, 77], {
    easing: Easing.out(Easing.quad),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}
