import { SceneContainer } from "@/components/scene-container";
import { countUp, entryScale, smoothSpring } from "@/lib/animation";
import { COLORS } from "@/lib/constants";
import { interpolateColors, useCurrentFrame, useVideoConfig } from "remotion";

/**
 * Brain Power counter increments +10 while a belt progress bar fills
 * and shifts from green to blue. Shows the mechanical link:
 * learn more -> BP goes up -> belt levels up.
 */
export function BrainPowerBelt() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const containerStyle = entryScale({ frame, delay: 0, duration: 12 });

  /** BP number counts from 2440 to 2450. */
  const bpValue = countUp({ frame, startFrame: 15, endFrame: 50, from: 2440, to: 2450 });

  /** +10 badge fades in at frame 15. */
  const badgeStyle = entryScale({ frame, delay: 15, duration: 10 });

  /** Belt bar fills from 72% to 78% and shifts color. */
  const barProgress = smoothSpring({ frame, fps, delay: 15, durationInFrames: 60 });
  const barFill = 0.72 + barProgress * 0.06;
  const barColor = interpolateColors(barProgress, [0, 1], [COLORS.bpGreen, COLORS.bpBlue]);

  return (
    <SceneContainer bg="white">
      <div
        style={{
          ...containerStyle,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 24,
        }}
      >
        {/* BP counter */}
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <span
            style={{
              fontSize: 72,
              fontWeight: 700,
              color: COLORS.text,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {bpValue.toLocaleString()}
          </span>
          <span
            style={{
              ...badgeStyle,
              fontSize: 28,
              fontWeight: 600,
              color: COLORS.bpGreen,
            }}
          >
            +10
          </span>
        </div>

        {/* Label */}
        <span style={{ fontSize: 18, fontWeight: 500, color: COLORS.muted }}>
          Brain Power
        </span>

        {/* Belt progress bar */}
        <div
          style={{
            width: 400,
            height: 8,
            borderRadius: 4,
            backgroundColor: COLORS.border,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${barFill * 100}%`,
              height: "100%",
              borderRadius: 4,
              backgroundColor: barColor,
            }}
          />
        </div>

        {/* Belt level label */}
        <span style={{ fontSize: 14, fontWeight: 500, color: COLORS.muted }}>
          Blue Belt — 78%
        </span>
      </div>
    </SceneContainer>
  );
}
