import { SceneContainer } from "@/components/scene-container";
import { entryScale, stagger } from "@/lib/animation";
import { COLORS } from "@/lib/constants";
import { Easing, interpolate, useCurrentFrame } from "remotion";

const WORDS = ["particle", "sound", "color"];
const CORRECT_INDEX = 0;
const SENTENCE_PREFIX = "Light behaves as both a wave and a";
const GAP_WIDTH = 140;

/**
 * Fill-in-the-blank interaction: a sentence with a gap,
 * and a word that floats up from a word bank into position.
 */
export function FillInBlank() {
  const frame = useCurrentFrame();

  /** The word floats from its bank position into the gap between frames 50-80. */
  const floatProgress = interpolate(frame, [50, 80], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  /** After the word lands, the gap turns green. */
  const successProgress = interpolate(frame, [80, 92], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const isFilled = floatProgress >= 1;
  const gapColor = isFilled && successProgress > 0.5 ? COLORS.success : COLORS.border;

  return (
    <SceneContainer bg="white">
      <div
        style={{
          ...entryScale({ frame, delay: 0, duration: 12 }),
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 48,
        }}
      >
        {/* Sentence with gap */}
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 8,
            fontSize: 28,
            fontWeight: 600,
            color: COLORS.text,
          }}
        >
          <span>{SENTENCE_PREFIX}</span>

          {/* Gap / filled word */}
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: GAP_WIDTH,
              borderBottom: `2.5px solid ${gapColor}`,
              paddingBottom: 4,
              minHeight: 36,
            }}
          >
            {isFilled && (
              <span
                style={{
                  color: successProgress > 0.5 ? COLORS.success : COLORS.text,
                  fontWeight: 600,
                }}
              >
                {WORDS[CORRECT_INDEX]}
              </span>
            )}
          </span>

          <span>.</span>
        </div>

        {/* Word bank */}
        <div style={{ display: "flex", gap: 16 }}>
          {WORDS.map((word, index) => {
            const delay = stagger({ index, baseDelay: 15, gap: 5 });
            const chipStyle = entryScale({ frame, delay });

            const isCorrect = index === CORRECT_INDEX;

            /**
             * The correct word floats upward when selected.
             * Its bank position fades to low opacity.
             */
            const translateY = isCorrect ? interpolate(floatProgress, [0, 1], [0, -120]) : 0;
            const chipOpacity = isCorrect && isFilled ? 0.2 : 1;

            return (
              <div
                key={word}
                style={{
                  ...chipStyle,
                  opacity: (chipStyle.opacity as number) * chipOpacity,
                  transform: `${chipStyle.transform} translateY(${translateY}px)`,
                  padding: "12px 24px",
                  borderRadius: 24,
                  border: `1.5px solid ${COLORS.border}`,
                  backgroundColor: COLORS.white,
                  fontSize: 20,
                  fontWeight: 500,
                  color: COLORS.text,
                }}
              >
                {word}
              </div>
            );
          })}
        </div>
      </div>
    </SceneContainer>
  );
}
