import { SceneContainer } from "@/components/scene-container";
import { entryScale } from "@/lib/animation";
import { COLORS } from "@/lib/constants";
import { useCurrentFrame } from "remotion";

/**
 * Clean Zoonk content card with plain-language explanation.
 * The "after" to StatusQuo's "before." The viewer sees at a glance
 * that Zoonk uses words they already know (ball, doorway, wave)
 * vs. the jargon card (quantum entities, interference patterns).
 */
export function ZoonkCard() {
  const frame = useCurrentFrame();
  const style = entryScale({ frame, delay: 0, duration: 12 });

  return (
    <SceneContainer bg="white">
      <div style={style}>
        <div
          style={{
            width: 600,
            padding: "40px 44px",
            borderRadius: 16,
            border: `1px solid ${COLORS.border}`,
            backgroundColor: COLORS.white,
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
          }}
        >
          {/* Title */}
          <h2
            style={{
              fontSize: 28,
              fontWeight: 600,
              color: COLORS.text,
              margin: 0,
              marginBottom: 8,
            }}
          >
            Both at once
          </h2>

          {/* Plain-language explanation */}
          <p
            style={{
              fontSize: 20,
              lineHeight: 1.7,
              color: COLORS.text,
              margin: 0,
              fontWeight: 400,
            }}
          >
            Imagine throwing a ball through a doorway — but the ball also ripples like a wave.
            That's how tiny particles behave.
          </p>
        </div>
      </div>
    </SceneContainer>
  );
}
