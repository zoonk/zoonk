import { SceneContainer } from "@/components/scene-container";
import { SceneHeadline } from "@/components/scene-headline";

/**
 * "Complex things, made simple." (instant)
 * → "Charts. Diagrams. Timelines." (word by word, muted — each lands like a punch)
 */
export function VisualsHeadline() {
  return (
    <SceneContainer bg="white">
      <SceneHeadline
        setup="Complex things,"
        payoff="made simple."
        payoffStartFrame={20}
        fontSize={56}
      />
    </SceneContainer>
  );
}
