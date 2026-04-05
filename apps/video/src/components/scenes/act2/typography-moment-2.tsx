import { SceneContainer } from "@/components/scene-container";
import { entryScale, stagger } from "@/lib/animation";
import { COLORS } from "@/lib/constants";
import { useCurrentFrame } from "remotion";

const WORDS = ["Hard ideas.", "Simple words."];

/**
 * "Hard ideas. Simple words." — same treatment as TypographyMoment1.
 * Both on white for consistent visual language.
 *
 * "Hard ideas." uses SemiBold (600), "Simple words." uses Regular (400)
 * to subtly reinforce the meaning through weight contrast.
 */
export function TypographyMoment2() {
  const frame = useCurrentFrame();

  const WEIGHTS = [600, 400] as const;

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
          const delay = stagger({ index, baseDelay: 15, gap: 20 });
          const style = entryScale({ frame, delay, duration: 15 });

          return (
            <span
              key={line}
              style={{
                ...style,
                fontSize: 56,
                fontWeight: WEIGHTS[index],
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
