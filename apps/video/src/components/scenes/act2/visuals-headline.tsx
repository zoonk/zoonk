import { SceneContainer } from "@/components/scene-container";
import { WordReveal } from "@/components/word-reveal";
import { COLORS } from "@/lib/constants";

/**
 * "Complex things, made simple." (instant)
 * → "Charts. Diagrams. Timelines." (word by word — each lands like a punch)
 */
export function VisualsHeadline() {
  return (
    <SceneContainer bg="white">
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 16,
        }}
      >
        <span
          style={{
            fontSize: 56,
            fontWeight: 600,
            color: COLORS.text,
            letterSpacing: "0.01em",
            lineHeight: 1.4,
          }}
        >
          Complex things, made simple.
        </span>
        <WordReveal
          text="Charts. Diagrams. Timelines."
          startFrame={20}
          style={{
            fontSize: 40,
            fontWeight: 400,
            color: COLORS.muted,
            letterSpacing: "0.01em",
            lineHeight: 1.4,
            justifyContent: "center",
          }}
        />
      </div>
    </SceneContainer>
  );
}
