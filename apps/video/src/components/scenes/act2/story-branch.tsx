import { SceneContainer } from "@/components/scene-container";
import { SceneHeadline } from "@/components/scene-headline";
import { entryScale, stagger } from "@/lib/animation";
import { COLORS } from "@/lib/constants";
import { useT } from "@/lib/use-translations";
import { interpolate, useCurrentFrame } from "remotion";

const CORRECT_INDEX = 1;
const WRONG_INDEX = 0;
const ERROR_COLOR = "#ef4444";

/**
 * "You learn" (instant, bold) → "by making decisions." (word by word, muted)
 * Text only — the claim.
 */
export function StoryClaim() {
  const t = useT();

  return (
    <SceneContainer bg="white">
      <SceneHeadline setup={t.storySetup} payoff={t.storyPayoff} payoffStartFrame={15} />
    </SceneContainer>
  );
}

/**
 * Scenario question + 3 choices. Correct choice (B) gets selected with green.
 * Shows the product working — clean, simple.
 */
export function StoryCorrect() {
  const frame = useCurrentFrame();
  const t = useT();

  const selectionProgress = interpolate(frame, [65, 77], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <SceneContainer bg="white">
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 24,
          maxWidth: 580,
        }}
      >
        {/* Scenario question — visible immediately */}
        <p
          style={{
            fontSize: 24,
            lineHeight: 1.6,
            color: COLORS.text,
            fontWeight: 500,
            textAlign: "center",
            margin: 0,
          }}
        >
          {t.storyScenario}
        </p>

        {/* Choice cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%", marginTop: 8 }}>
          {t.storyChoices.map((choice, index) => {
            const delay = stagger({ index, baseDelay: 12, gap: 6 });
            const choiceStyle = entryScale({ frame, delay });

            const isCorrect = index === CORRECT_INDEX;
            const borderColor = isCorrect && selectionProgress > 0.5 ? COLORS.success : COLORS.border;
            const bgColor = isCorrect ? `rgba(22, 163, 74, ${selectionProgress * 0.04})` : "transparent";
            const badgeBg = isCorrect && selectionProgress > 0.5 ? COLORS.success : "transparent";
            const badgeBorder = isCorrect && selectionProgress > 0.5 ? COLORS.success : COLORS.border;
            const badgeColor = isCorrect && selectionProgress > 0.5 ? COLORS.primaryFg : COLORS.muted;

            return (
              <div
                key={choice}
                style={{
                  ...choiceStyle,
                  padding: "16px 22px",
                  borderRadius: 12,
                  border: `1.5px solid ${borderColor}`,
                  backgroundColor: bgColor,
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                }}
              >
                <span
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 13,
                    border: `1.5px solid ${badgeBorder}`,
                    backgroundColor: badgeBg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    fontWeight: 600,
                    color: badgeColor,
                    flexShrink: 0,
                  }}
                >
                  {String.fromCharCode(65 + index)}
                </span>
                <span
                  style={{
                    fontSize: 17,
                    fontWeight: isCorrect && selectionProgress > 0.5 ? 600 : 400,
                    color: COLORS.text,
                  }}
                >
                  {choice}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </SceneContainer>
  );
}

/**
 * "Make a mistake?" → "You'll know why." (headline)
 * Then choices appear, wrong one (A) selected → red + shake → feedback.
 * Shows the product teaching.
 */
export function StoryFeedback() {
  const frame = useCurrentFrame();
  const t = useT();

  const wrongProgress = interpolate(frame, [55, 65], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const errorProgress = interpolate(frame, [65, 75], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const feedbackProgress = interpolate(frame, [78, 88], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const shakeX =
    frame >= 65 && frame <= 80
      ? interpolate(frame, [65, 67, 69, 71, 73, 75], [0, -4, 4, -3, 2, 0], {
          extrapolateRight: "clamp",
        })
      : 0;

  return (
    <SceneContainer bg="white">
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 28,
          maxWidth: 580,
        }}
      >
        <SceneHeadline
          setup={t.storyFeedbackSetup}
          payoff={t.storyFeedbackPayoff}
          payoffStartFrame={15}
        />

        {/* Choices — appear after headline */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%", marginTop: 4 }}>
          {t.storyChoices.map((choice, index) => {
            const choiceStyle = entryScale({ frame, delay: stagger({ index, baseDelay: 35, gap: 4 }) });

            const isWrong = index === WRONG_INDEX;

            const { borderColor, bgColor, badgeBg, badgeBorder, badgeColor, textWeight } =
              getWrongChoiceStyles({ isWrong, wrongProgress, errorProgress });

            return (
              <div key={choice} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div
                  style={{
                    ...choiceStyle,
                    padding: "16px 22px",
                    borderRadius: 12,
                    border: `1.5px solid ${borderColor}`,
                    backgroundColor: bgColor,
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    transform: isWrong ? `translateX(${shakeX}px)` : undefined,
                  }}
                >
                  <span
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 13,
                      border: `1.5px solid ${badgeBorder}`,
                      backgroundColor: badgeBg,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 12,
                      fontWeight: 600,
                      color: badgeColor,
                      flexShrink: 0,
                    }}
                  >
                    {String.fromCharCode(65 + index)}
                  </span>
                  <span style={{ fontSize: 17, fontWeight: textWeight, color: COLORS.text }}>
                    {choice}
                  </span>
                </div>

                {/* Feedback message */}
                {isWrong && feedbackProgress > 0 && (
                  <div
                    style={{
                      ...entryScale({ frame, delay: 78, duration: 10 }),
                      paddingLeft: 22,
                      paddingRight: 22,
                    }}
                  >
                    <span style={{ fontSize: 14, fontWeight: 400, color: COLORS.muted, lineHeight: 1.5 }}>
                      {t.storyFeedback}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </SceneContainer>
  );
}

function getWrongChoiceStyles({
  isWrong,
  wrongProgress,
  errorProgress,
}: {
  isWrong: boolean;
  wrongProgress: number;
  errorProgress: number;
}) {
  if (isWrong && wrongProgress > 0.5) {
    const isError = errorProgress > 0.5;
    return {
      borderColor: isError ? ERROR_COLOR : COLORS.primary,
      bgColor: isError ? "rgba(239, 68, 68, 0.04)" : "rgba(23, 23, 23, 0.04)",
      badgeBorder: isError ? ERROR_COLOR : COLORS.primary,
      badgeBg: isError ? ERROR_COLOR : COLORS.primary,
      badgeColor: COLORS.primaryFg,
      textWeight: 600,
    };
  }

  return {
    borderColor: COLORS.border,
    bgColor: "transparent",
    badgeBorder: COLORS.border,
    badgeBg: "transparent",
    badgeColor: COLORS.muted,
    textWeight: 400,
  };
}
