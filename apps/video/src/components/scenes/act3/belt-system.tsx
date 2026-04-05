import { SceneContainer } from "@/components/scene-container";
import { WordReveal } from "@/components/word-reveal";
import { entryScale, exitFade, stagger } from "@/lib/animation";
import { BELT_COLORS, COLORS } from "@/lib/constants";
import { useCurrentFrame } from "remotion";

/**
 * Beat 1: "Become a black belt" (instant) → "in your field." (word by word)
 * + 10 colored circles stagger in.
 *
 * Beat 2: "Like martial arts." (instant) → "But for your brain." (word by word, lighter weight)
 */
export function BeltSystem() {
  const frame = useCurrentFrame();

  const beat1Fading = frame >= 65;
  const beat1FadeStyle = beat1Fading ? exitFade({ frame, start: 65, duration: 10 }) : {};

  return (
    <SceneContainer bg="white">
      {/* Beat 1: Headline + belt circles */}
      <div
        style={{
          ...beat1FadeStyle,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 40,
          position: "absolute",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 4,
          }}
        >
          <span style={{ fontSize: 44, fontWeight: 700, color: COLORS.text }}>
            Become a black belt
          </span>
          <WordReveal
            text="in your field."
            startFrame={15}
            style={{ fontSize: 44, fontWeight: 700, color: COLORS.text, justifyContent: "center" }}
          />
        </div>

        {/* 10 belt color circles */}
        <div style={{ display: "flex", gap: 16 }}>
          {BELT_COLORS.map((belt, index) => {
            const delay = stagger({ index, baseDelay: 28, gap: 3 });
            const style = entryScale({ frame, delay });

            return (
              <div
                key={belt.name}
                style={{
                  ...style,
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: belt.hex,
                  boxShadow: belt.name === "White" ? `inset 0 0 0 1px ${COLORS.border}` : "none",
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Beat 2: Punchline with word-by-word */}
      {frame >= 77 && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 4,
            position: "absolute",
          }}
        >
          <WordReveal
            text="Like martial arts."
            startFrame={77}
            style={{ fontSize: 44, fontWeight: 700, color: COLORS.text, justifyContent: "center" }}
          />
          <WordReveal
            text="But for your brain."
            startFrame={100}
            style={{ fontSize: 44, fontWeight: 400, color: COLORS.text, justifyContent: "center" }}
          />
        </div>
      )}
    </SceneContainer>
  );
}
