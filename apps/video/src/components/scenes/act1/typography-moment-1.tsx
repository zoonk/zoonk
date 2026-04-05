import { SceneContainer } from "@/components/scene-container";
import { entryScale, stagger } from "@/lib/animation";
import { COLORS } from "@/lib/constants";
import { useCurrentFrame } from "remotion";

const WORDS = ["Type anything.", "Learn everything."];

/**
 * "Type anything. Learn everything." appears line by line.
 * SemiBold 56px, dark text on white, generous spacing.
 * The periods land with weight.
 */
export function TypographyMoment1() {
  const frame = useCurrentFrame();

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
        {WORDS.map((line, index) => {
          const delay = stagger({ index, baseDelay: 10, gap: 18 });
          const style = entryScale({ frame, delay, duration: 15 });

          return (
            <span
              key={line}
              style={{
                ...style,
                fontSize: 56,
                fontWeight: 600,
                color: COLORS.text,
                letterSpacing: "0.01em",
                lineHeight: 1.4,
              }}
            >
              {line}
            </span>
          );
        })}
      </div>
    </SceneContainer>
  );
}
