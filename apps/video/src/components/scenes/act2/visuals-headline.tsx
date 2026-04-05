import { SceneContainer } from "@/components/scene-container";
import { entryScale, stagger } from "@/lib/animation";
import { COLORS } from "@/lib/constants";
import { useCurrentFrame } from "remotion";

const LINES = ["Complex things, made simple.", "Charts. Diagrams. Timelines."];
const WEIGHTS = [600, 400] as const;

/**
 * Typography beat that sets up the visuals montage.
 * Line 1 (the WHY): "Complex things, made simple." — bold, confident.
 * Line 2 (the WHAT): "Charts. Diagrams. Timelines." — lighter, like a friend adding detail.
 */
export function VisualsHeadline() {
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
        {LINES.map((line, index) => {
          const delay = stagger({ index, baseDelay: 10, gap: 20 });
          const style = entryScale({ frame, delay, duration: 15 });

          return (
            <span
              key={line}
              style={{
                ...style,
                fontSize: index === 0 ? 56 : 40,
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
