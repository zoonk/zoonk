import { SceneContainer } from "@/components/scene-container";
import { WordReveal } from "@/components/word-reveal";
import { COLORS } from "@/lib/constants";

/**
 * "You can learn anything." — word by word, all bold, all black.
 * The emotional climax. Words accumulate on screen building the full sentence.
 * No setup/payoff split — every word carries equal weight.
 */
export function ClosingWords() {
  return (
    <SceneContainer bg="white">
      <WordReveal
        text="You can learn anything."
        startFrame={0}
        style={{
          fontSize: 72,
          fontWeight: 700,
          color: COLORS.text,
          justifyContent: "center",
        }}
      />
    </SceneContainer>
  );
}
