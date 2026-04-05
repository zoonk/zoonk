import { SceneContainer } from "@/components/scene-container";
import { SceneHeadline } from "@/components/scene-headline";
import { countUp, entryScale } from "@/lib/animation";
import { COLORS } from "@/lib/constants";
import { useCurrentFrame } from "remotion";

/**
 * "YOUR LEARNING PATTERNS" (instant label)
 * → stats fade in
 * → "Know when and how you learn best," (setup, bold)
 * → "so you can be more productive." (payoff, muted, word by word)
 */
export function PerformanceStats() {
  const frame = useCurrentFrame();

  const leftStatStyle = entryScale({ frame, delay: 8, duration: 12 });
  const rightStatStyle = entryScale({ frame, delay: 14, duration: 12 });

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
        {/* Label — visible immediately */}
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

        {/* Why it matters — using SceneHeadline for consistent styling */}
        <SceneHeadline
          setup="Know when and how you learn best,"
          payoff="so you can be more productive."
          payoffStartFrame={72}
          fontSize={20}
        />
      </div>
    </SceneContainer>
  );
}
