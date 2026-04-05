import { SceneContainer } from "@/components/scene-container";
import { countUp, entryScale } from "@/lib/animation";
import { COLORS } from "@/lib/constants";
import { useCurrentFrame } from "remotion";

const STATS = [
  { label: "Lessons", from: 0, to: 12, color: COLORS.text },
  { label: "Brain Power", from: 0, to: 2450, color: COLORS.bpGreen },
  { label: "Day Streak", from: 0, to: 7, color: COLORS.energy },
] as const;

/**
 * Three stats counting up simultaneously: lessons complete, brain power, streak.
 * Numbers use tabular-nums for a satisfying, slot-machine-like animation.
 */
export function PerformanceStats() {
  const frame = useCurrentFrame();
  const containerStyle = entryScale({ frame, delay: 0, duration: 12 });

  return (
    <SceneContainer bg="white">
      <div
        style={{
          ...containerStyle,
          display: "flex",
          gap: 80,
          alignItems: "flex-start",
        }}
      >
        {STATS.map((stat) => {
          const value = countUp({
            frame,
            startFrame: 12,
            endFrame: 65,
            from: stat.from,
            to: stat.to,
          });

          return (
            <div
              key={stat.label}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span
                style={{
                  fontSize: 56,
                  fontWeight: 700,
                  color: stat.color,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {value.toLocaleString()}
              </span>
              <span style={{ fontSize: 16, fontWeight: 500, color: COLORS.muted }}>
                {stat.label}
              </span>
            </div>
          );
        })}
      </div>
    </SceneContainer>
  );
}
