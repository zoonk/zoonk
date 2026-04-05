import { SceneContainer } from "@/components/scene-container";
import { SceneHeadline } from "@/components/scene-headline";
import { useT } from "@/lib/use-translations";

/**
 * "Complex things, made simple." (instant)
 * → "Charts. Diagrams. Timelines." (word by word, muted — each lands like a punch)
 */
export function VisualsHeadline() {
  const t = useT();

  return (
    <SceneContainer bg="white">
      <SceneHeadline
        setup={t.visualsSetup}
        payoff={t.visualsPayoff}
        payoffStartFrame={20}
        fontSize={56}
      />
    </SceneContainer>
  );
}
