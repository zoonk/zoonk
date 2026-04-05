import { SceneContainer } from "@/components/scene-container";
import { countUp, entryScale } from "@/lib/animation";
import { COLORS } from "@/lib/constants";
import { useCurrentFrame } from "remotion";

/**
 * Performance tracking scene with three layers:
 *
 * 1. Label: "YOUR LEARNING PATTERNS" (small, uppercase)
 * 2. Two hero stats: "Tue, 8 AM" (best focus time) + "87%" (accuracy)
 * 3. Why it matters: "Know when and how you learn best, so you can be more productive."
 */
export function PerformanceStats() {
  const frame = useCurrentFrame();

  const leftStatStyle = entryScale({ frame, delay: 8, duration: 12 });
  const rightStatStyle = entryScale({ frame, delay: 14, duration: 12 });
  const whyStyle = entryScale({ frame, delay: 35, duration: 12 });

  const accuracy = countUp({ frame, startFrame: 18, endFrame: 55, from: 0, to: 87 });

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
        {/* Label */}
        <span
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: COLORS.muted,
            letterSpacing: "0.08em",
            textTransform: "uppercase" as const,
          }}
        >
          Your learning patterns
        </span>

        {/* Two hero stats side by side */}
        <div style={{ display: "flex", gap: 80, alignItems: "flex-start" }}>
          {/* Best focus time */}
          <div
            style={{
              ...leftStatStyle,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span style={{ fontSize: 48, fontWeight: 700, color: COLORS.text }}>Tue, 8 AM</span>
            <span style={{ fontSize: 14, fontWeight: 500, color: COLORS.muted }}>Best focus time</span>
          </div>

          {/* Accuracy */}
          <div
            style={{
              ...rightStatStyle,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span
              style={{
                fontSize: 48,
                fontWeight: 700,
                color: COLORS.bpGreen,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {accuracy}%
            </span>
            <span style={{ fontSize: 14, fontWeight: 500, color: COLORS.muted }}>Accuracy</span>
          </div>
        </div>

        {/* Why it matters */}
        <span
          style={{
            ...whyStyle,
            fontSize: 20,
            fontWeight: 400,
            color: COLORS.muted,
            textAlign: "center",
            maxWidth: 500,
          }}
        >
          Know when and how you learn best, so you can be more productive.
        </span>
      </div>
    </SceneContainer>
  );
}
