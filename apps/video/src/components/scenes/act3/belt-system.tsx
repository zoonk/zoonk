import { SceneContainer } from "@/components/scene-container";
import { entryScale, exitFade, stagger } from "@/lib/animation";
import { BELT_COLORS, COLORS } from "@/lib/constants";
import { useCurrentFrame } from "remotion";

/**
 * Belt progression scene with two beats:
 *
 * Beat 1: "Become a black belt in your field."
 * + 10 colored circles stagger in L→R showing the full journey.
 *
 * Beat 2: Circles and first text fade. "Like martial arts. But for your brain."
 * lands as the punchline — lighter weight, like a confident smile.
 */
export function BeltSystem() {
  const frame = useCurrentFrame();

  /** Beat 1: text + belt circles (frames 0-60). */
  const beat1TextStyle = entryScale({ frame, delay: 0, duration: 12 });
  const beat1Fading = frame >= 55;
  const beat1FadeStyle = beat1Fading ? exitFade({ frame, start: 55, duration: 10 }) : {};

  /** Beat 2: punchline text (frames 65+). */
  const beat2Style = entryScale({ frame, delay: 65, duration: 12 });

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
        <span
          style={{
            ...beat1TextStyle,
            fontSize: 44,
            fontWeight: 600,
            color: COLORS.text,
            textAlign: "center",
          }}
        >
          Become a black belt in your field.
        </span>

        {/* 10 belt color circles */}
        <div style={{ display: "flex", gap: 16 }}>
          {BELT_COLORS.map((belt, index) => {
            const delay = stagger({ index, baseDelay: 12, gap: 4 });
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

      {/* Beat 2: Punchline */}
      <span
        style={{
          ...beat2Style,
          fontSize: 44,
          fontWeight: 400,
          color: COLORS.text,
          textAlign: "center",
          position: "absolute",
        }}
      >
        Like martial arts. But for your brain.
      </span>
    </SceneContainer>
  );
}
