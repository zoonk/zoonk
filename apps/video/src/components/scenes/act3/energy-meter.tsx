import { SceneContainer } from "@/components/scene-container";
import { entryScale } from "@/lib/animation";
import { COLORS } from "@/lib/constants";
import { Easing, interpolate, useCurrentFrame } from "remotion";

const ARC_CIRCUMFERENCE = Math.PI * 80;

/**
 * Energy meter showing 78, dipping to 76, then recovering to 77.
 * The tiny 2-point drop IS the message: miss a day, it dips, it doesn't disappear.
 * SVG semicircular arc gauge.
 */
export function EnergyMeter() {
  const frame = useCurrentFrame();
  const containerStyle = entryScale({ frame, delay: 0, duration: 12 });

  /**
   * Three-phase animation: 78 -> 76 -> 77.
   * Frames 20-40: dip from 78 to 76.
   * Frames 50-75: recover to 77.
   */
  const energyValue = getEnergyValue(frame);
  const arcFraction = energyValue / 100;
  const arcDashoffset = ARC_CIRCUMFERENCE * (1 - arcFraction);

  /** "Missed 2 days" label fades in during the dip. */
  const missedOpacity = interpolate(frame, [22, 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <SceneContainer bg="white">
      <div
        style={{
          ...containerStyle,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 20,
        }}
      >
        {/* SVG circular arc gauge */}
        <div style={{ position: "relative", width: 200, height: 120 }}>
          <svg width={200} height={120} viewBox="0 0 200 120">
            {/* Background arc */}
            <path
              d="M 20 100 A 80 80 0 0 1 180 100"
              fill="none"
              stroke={COLORS.border}
              strokeWidth={8}
              strokeLinecap="round"
            />
            {/* Filled arc */}
            <path
              d="M 20 100 A 80 80 0 0 1 180 100"
              fill="none"
              stroke={COLORS.energy}
              strokeWidth={8}
              strokeLinecap="round"
              strokeDasharray={ARC_CIRCUMFERENCE}
              strokeDashoffset={arcDashoffset}
            />
          </svg>

          {/* Energy number centered in the arc */}
          <div
            style={{
              position: "absolute",
              top: 40,
              left: 0,
              right: 0,
              display: "flex",
              justifyContent: "center",
            }}
          >
            <span
              style={{
                fontSize: 56,
                fontWeight: 700,
                color: COLORS.energy,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {Math.round(energyValue)}
            </span>
          </div>
        </div>

        {/* Label */}
        <span style={{ fontSize: 18, fontWeight: 500, color: COLORS.muted }}>Energy</span>

        {/* "Missed 2 days" indicator */}
        <span
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: COLORS.muted,
            opacity: missedOpacity,
          }}
        >
          Missed 2 days — it dips. It doesn't disappear.
        </span>
      </div>
    </SceneContainer>
  );
}

/** Returns the energy value at a given frame: 78 -> 76 -> 77. */
function getEnergyValue(frame: number): number {
  if (frame < 20) return 78;

  if (frame < 50) {
    return interpolate(frame, [20, 40], [78, 76], {
      easing: Easing.inOut(Easing.quad),
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  }

  return interpolate(frame, [50, 75], [76, 77], {
    easing: Easing.out(Easing.quad),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}
