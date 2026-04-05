import { SceneContainer } from "@/components/scene-container";
import { WordReveal } from "@/components/word-reveal";
import { countUp, entryScale } from "@/lib/animation";
import { COLORS } from "@/lib/constants";
import { useCurrentFrame } from "remotion";

/**
 * "Your Brain Power only goes up." (instant)
 * → "Never down." (word by word)
 * → "Because knowledge is something nobody can take from you." (quiet fade)
 * → counter as proof.
 */
export function BrainPower() {
  const frame = useCurrentFrame();

  const reasonStyle = entryScale({ frame, delay: 40, duration: 12 });
  const counterStyle = entryScale({ frame, delay: 60, duration: 12 });

  const bpValue = countUp({ frame, startFrame: 65, endFrame: 95, from: 2440, to: 2450 });
  const badgeStyle = entryScale({ frame, delay: 65, duration: 10 });

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
        {/* Bold claim with word-by-word payoff */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 4,
          }}
        >
          <span style={{ fontSize: 44, fontWeight: 700, color: COLORS.text, textAlign: "center" }}>
            Your Brain Power only goes up.
          </span>
          <WordReveal
            text="Never down."
            startFrame={20}
            style={{ fontSize: 44, fontWeight: 700, color: COLORS.text, justifyContent: "center" }}
          />
        </div>

        {/* Quiet philosophical line */}
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
        <div style={{ ...counterStyle, display: "flex", alignItems: "baseline", gap: 12, marginTop: 12 }}>
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
