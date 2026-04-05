import { SceneContainer } from "@/components/scene-container";
import { entryScale } from "@/lib/animation";
import { COLORS } from "@/lib/constants";
import { Easing, interpolate, useCurrentFrame } from "remotion";

const ARC_CIRCUMFERENCE = Math.PI * 80;

/**
 * "Miss a day? Your energy dips a little. But it doesn't disappear."
 * "No guilt. No punishment. Just pick up where you left off."
 *
 * Three-layer scene: bold claim, muted reasoning, arc gauge proof.
 * Mirrors the Brain Power scene structure.
 */
export function EnergyMeter() {
  const frame = useCurrentFrame();

  const headlineStyle = entryScale({ frame, delay: 0, duration: 12 });
  const reasonStyle = entryScale({ frame, delay: 30, duration: 12 });
  const gaugeStyle = entryScale({ frame, delay: 50, duration: 12 });

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
          gap: 20,
        }}
      >
        {/* Bold claim */}
        <div
          style={{
            ...headlineStyle,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 4,
          }}
        >
          <span style={{ fontSize: 40, fontWeight: 600, color: COLORS.text, textAlign: "center" }}>
            Miss a day? Your energy dips a little.
          </span>
          <span style={{ fontSize: 40, fontWeight: 600, color: COLORS.text }}>
            But it doesn't disappear.
          </span>
        </div>

        {/* Emotional reasoning */}
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
  if (frame < 55) return 78;

  if (frame < 80) {
    return interpolate(frame, [55, 75], [78, 76], {
      easing: Easing.inOut(Easing.quad),
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  }

  return interpolate(frame, [80, 105], [76, 77], {
    easing: Easing.out(Easing.quad),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}
