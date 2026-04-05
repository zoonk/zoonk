import { SceneContainer } from "@/components/scene-container";
import { COLORS } from "@/lib/constants";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import { useT } from "../../use-translations";

/**
 * Assigns each jargon word to a fade wave (1-3) or marks it as an anchor
 * (a word that survives the distillation). Anchors are matched in order
 * against the simpleWords array.
 */
function classifyWords(
  jargonText: string,
  simpleWords: string[],
): Array<{ word: string; isAnchor: boolean; wave: number }> {
  const jargonWords = jargonText.split(" ");
  let anchorIndex = 0;
  let nonAnchorCount = 0;

  return jargonWords.map((word) => {
    const target = simpleWords[anchorIndex];

    if (
      target &&
      word.toLowerCase().replace(/[.,]$/, "") === target.toLowerCase().replace(/[.,]$/, "")
    ) {
      anchorIndex++;
      return { word, isAnchor: true, wave: 0 };
    }

    nonAnchorCount++;
    /** Distribute non-anchor words across 3 waves for staggered removal. */
    const wave = ((nonAnchorCount - 1) % 3) + 1;
    return { word, isAnchor: false, wave };
  });
}

/**
 * Dense jargon text distills into a simple sentence. Non-essential words
 * fade out in staggered waves while anchor words (the simple sentence)
 * survive, grow larger, and darken — showing simplification as subtraction.
 */
export function LanguageTransform() {
  const frame = useCurrentFrame();
  const t = useT();

  const classified = classifyWords(t.jargon, t.simpleWords);

  /** Phase 1: paragraph enters. */
  const enterOpacity = interpolate(frame, [0, 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  /**
   * Phase 2: waves of non-anchor words fade out.
   * Wave 1: frames 25-40, Wave 2: frames 35-50, Wave 3: frames 45-60.
   */
  const waveOpacity = (wave: number): number => {
    const start = 25 + (wave - 1) * 10;
    return interpolate(frame, [start, start + 15], [1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.inOut(Easing.quad),
    });
  };

  /**
   * Phase 3: anchor words grow and darken.
   * Starts at frame 50, settles by frame 80.
   */
  const anchorProgress = interpolate(frame, [50, 80], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });

  const anchorFontSize = interpolate(anchorProgress, [0, 1], [16, 32]);
  const anchorWeight = anchorProgress > 0.5 ? 500 : 400;
  const anchorColor = anchorProgress > 0.5 ? COLORS.text : COLORS.muted;

  /** Non-anchor words shrink as they fade to help close gaps. */
  const nonAnchorFontSize = (wave: number): number => {
    const opacity = waveOpacity(wave);
    return opacity * 16;
  };

  return (
    <SceneContainer bg="white">
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: "4px 6px",
          maxWidth: 750,
          opacity: enterOpacity,
        }}
      >
        {classified.map(({ word, isAnchor, wave }, index) => {
          if (isAnchor) {
            return (
              <span
                key={index}
                style={{
                  fontSize: anchorFontSize,
                  fontWeight: anchorWeight,
                  color: anchorColor,
                  whiteSpace: "nowrap",
                  lineHeight: 1.6,
                }}
              >
                {word}
              </span>
            );
          }

          const opacity = waveOpacity(wave);
          const fontSize = nonAnchorFontSize(wave);

          if (opacity <= 0) return null;

          return (
            <span
              key={index}
              style={{
                fontSize,
                fontWeight: 400,
                color: COLORS.muted,
                opacity,
                whiteSpace: "nowrap",
                lineHeight: 1.6,
              }}
            >
              {word}
            </span>
          );
        })}
      </div>
    </SceneContainer>
  );
}
