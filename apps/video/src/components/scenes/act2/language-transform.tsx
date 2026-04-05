import { SceneContainer } from "@/components/scene-container";
import { COLORS } from "@/lib/constants";
import { Easing, interpolate, useCurrentFrame } from "remotion";

const JARGON =
  "Wave-particle duality constitutes a fundamental ontological principle " +
  "within the theoretical framework of quantum mechanics, whereby subatomic " +
  "entities — including but not limited to photons, electrons, and other " +
  "elementary particles — simultaneously exhibit characteristics attributable " +
  "to both classical wave phenomena and discrete corpuscular behavior, as " +
  "empirically demonstrated through interference patterns observed in the " +
  "double-slit experiment, thereby challenging deterministic interpretations " +
  "of physical reality and necessitating a probabilistic reformulation of " +
  "measurement theory within the Copenhagen interpretation.";

const SIMPLE = "Light acts like both a wave and a ball.";

/**
 * Dense jargon paragraph dissolves (opacity + blur + scale down)
 * while a simple sentence emerges (opacity + scale up) in the same
 * position. The brief overlap — jargon becoming illegible fog while
 * clarity sharpens — reads as transformation, not a cut.
 */
export function LanguageTransform() {
  const frame = useCurrentFrame();

  /**
   * Jargon: enters frames 0-8, holds briefly 8-35, dissolves 35-65.
   * The jargon is meant to overwhelm — viewer sees a wall of text,
   * feels "this is too much", then relief comes quickly.
   *
   * Simple: emerges 50-80 (15-frame overlap), holds 80-150.
   * The clean sentence gets most of the screen time (~2.3s).
   */
  const jargonOpacity = interpolate(frame, [0, 8, 35, 65], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const jargonBlur = interpolate(frame, [35, 65], [0, 10], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.ease),
  });

  const jargonScale = interpolate(frame, [35, 65], [1, 0.96], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.ease),
  });

  const simpleOpacity = interpolate(frame, [50, 80], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const simpleScale = interpolate(frame, [50, 80], [0.97, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.ease),
  });

  return (
    <SceneContainer bg="white">
      <div style={{ position: "relative", width: 700, height: 200, textAlign: "center" }}>
        {/* Dense jargon paragraph — small, muted, feels like a textbook */}
        <p
          style={{
            position: "absolute",
            top: "50%",
            left: 0,
            right: 0,
            transform: `translateY(-50%) scale(${jargonScale})`,
            fontSize: 15,
            fontWeight: 400,
            color: COLORS.muted,
            lineHeight: 1.7,
            margin: 0,
            opacity: jargonOpacity,
            filter: `blur(${jargonBlur}px)`,
          }}
        >
          {JARGON}
        </p>

        {/* Simple sentence — larger, dark, confident, emerges from the fog */}
        <p
          style={{
            position: "absolute",
            top: "50%",
            left: 0,
            right: 0,
            transform: `translateY(-50%) scale(${simpleScale})`,
            fontSize: 32,
            fontWeight: 500,
            color: COLORS.text,
            lineHeight: 1.4,
            margin: 0,
            opacity: simpleOpacity,
          }}
        >
          {SIMPLE}
        </p>
      </div>
    </SceneContainer>
  );
}
