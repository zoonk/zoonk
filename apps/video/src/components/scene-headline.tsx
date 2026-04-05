import { WordReveal } from "@/components/word-reveal";
import { COLORS } from "@/lib/constants";

/**
 * Consistent setup/payoff text pair used across all storytelling scenes.
 *
 * - Setup line: instant (hard cut), bold 700, dark color
 * - Payoff line: word-by-word reveal, regular 400, muted color
 *
 * This ensures visual hierarchy is identical across every scene —
 * no drift between font weights, colors, or sizes.
 */
export function SceneHeadline({
  setup,
  payoff,
  payoffStartFrame = 18,
  fontSize = 40,
}: {
  setup: string;
  payoff: string;
  payoffStartFrame?: number;
  fontSize?: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
      }}
    >
      <span
        style={{
          fontSize,
          fontWeight: 700,
          color: COLORS.text,
          textAlign: "center",
        }}
      >
        {setup}
      </span>
      <WordReveal
        text={payoff}
        startFrame={payoffStartFrame}
        style={{
          fontSize,
          fontWeight: 400,
          color: COLORS.muted,
          textAlign: "center",
          justifyContent: "center",
        }}
      />
    </div>
  );
}
