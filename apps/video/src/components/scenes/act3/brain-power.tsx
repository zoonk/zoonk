import { SceneContainer } from "@/components/scene-container";
import { countUp, entryScale } from "@/lib/animation";
import { COLORS } from "@/lib/constants";
import { useCurrentFrame } from "remotion";

/**
 * "Your Brain Power only goes up. Never down."
 * "Because knowledge is something nobody can take from you."
 *
 * Bold claim at top, emotional reasoning in the middle (muted),
 * then the Brain Power counter as proof at the bottom.
 */
export function BrainPower() {
  const frame = useCurrentFrame();

  const headlineStyle = entryScale({ frame, delay: 0, duration: 12 });
  const reasonStyle = entryScale({ frame, delay: 30, duration: 12 });
  const counterStyle = entryScale({ frame, delay: 55, duration: 12 });

  const bpValue = countUp({ frame, startFrame: 60, endFrame: 90, from: 2440, to: 2450 });
  const badgeStyle = entryScale({ frame, delay: 60, duration: 10 });

  return (
    <SceneContainer bg="white">
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 24,
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
          <span style={{ fontSize: 44, fontWeight: 600, color: COLORS.text, textAlign: "center" }}>
            Your Brain Power only goes up.
          </span>
          <span style={{ fontSize: 44, fontWeight: 600, color: COLORS.text }}>Never down.</span>
        </div>

        {/* Emotional reasoning */}
        <span
          style={{
            ...reasonStyle,
            fontSize: 24,
            fontWeight: 400,
            color: COLORS.muted,
            textAlign: "center",
            maxWidth: 600,
          }}
        >
          Because knowledge is something nobody can take from you.
        </span>

        {/* Brain Power counter */}
        <div style={{ ...counterStyle, display: "flex", alignItems: "baseline", gap: 12, marginTop: 16 }}>
          <span
            style={{
              fontSize: 64,
              fontWeight: 700,
              color: COLORS.text,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {bpValue.toLocaleString()}
          </span>
          <span style={{ ...badgeStyle, fontSize: 24, fontWeight: 600, color: COLORS.bpGreen }}>
            +10
          </span>
        </div>

        <span style={{ ...counterStyle, fontSize: 16, fontWeight: 500, color: COLORS.muted }}>
          Brain Power
        </span>
      </div>
    </SceneContainer>
  );
}
