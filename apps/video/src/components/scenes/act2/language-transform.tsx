import { SceneContainer } from "@/components/scene-container";
import { COLORS } from "@/lib/constants";
import { useT } from "@/lib/use-translations";
import { Easing, interpolate, useCurrentFrame } from "remotion";

/**
 * Dense jargon paragraph dissolves (opacity + blur + scale down)
 * while a simple sentence emerges (opacity + scale up) in the same
 * position. The brief overlap — jargon becoming illegible fog while
 * clarity sharpens — reads as transformation, not a cut.
 */
export function LanguageTransform() {
  const frame = useCurrentFrame();
  const t = useT();

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
          {t.jargon}
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
          {t.simple}
        </p>
      </div>
    </SceneContainer>
  );
}
