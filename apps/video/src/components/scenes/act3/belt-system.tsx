import { SceneContainer } from "@/components/scene-container";
import { SceneHeadline } from "@/components/scene-headline";
import { entryScale, exitFade, stagger } from "@/lib/animation";
import { BELT_COLORS } from "@/lib/constants";
import { useCurrentFrame } from "remotion";

/**
 * Beat 1: "Become a black belt" (instant, bold) → "in your field." (word by word, muted)
 * + 10 colored circles stagger in.
 *
 * Beat 2: "Like martial arts." (bold) → "But for your brain." (word by word, muted — the twist)
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
        <SceneHeadline
          setup="Become a black belt"
          payoff="in anything you learn."
          payoffStartFrame={15}
          fontSize={44}
        />

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
                  boxShadow: belt.name === "White" ? "inset 0 0 0 1px #e7e5e4" : "none",
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Beat 2: Punchline */}
      {frame >= 77 && (
        <div style={{ position: "absolute" }}>
          <SceneHeadline
            setup="Like martial arts."
            payoff="But for your brain."
            payoffStartFrame={100}
            fontSize={44}
          />
        </div>
      )}
    </SceneContainer>
  );
}
