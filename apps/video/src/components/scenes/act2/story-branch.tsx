import { SceneContainer } from "@/components/scene-container";
import { entryScale, stagger } from "@/lib/animation";
import { COLORS } from "@/lib/constants";
import { interpolate, useCurrentFrame } from "remotion";

const SCENARIO =
  "You're running a laser calibration lab. Your latest readings are inconsistent. " +
  "One sensor says wave, another says particle.";

const CHOICES = [
  "Recalibrate both sensors",
  "Check the observation method",
  "Increase sample size",
];

const WRONG_INDEX = 0;
const CORRECT_INDEX = 1;
const ERROR_COLOR = "#ef4444";

/**
 * "You learn by making decisions."
 *
 * Flow: viewer sees scenario → wrong choice (A) selected → red border,
 * brief feedback → correct choice (B) selected → green border.
 * Shows the full learning loop: try, fail, learn.
 */
export function StoryBranch() {
  const frame = useCurrentFrame();

  const scenarioStyle = entryScale({ frame, delay: 10, duration: 12 });

  /**
   * Timeline:
   * Frame 65-75: Wrong choice (A) selects
   * Frame 75-90: Red border + shake on A
   * Frame 110-120: Correct choice (B) selects
   * Frame 120+: Green border on B
   */
  const wrongProgress = interpolate(frame, [65, 75], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const errorProgress = interpolate(frame, [75, 85], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const correctProgress = interpolate(frame, [110, 120], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  /** Feedback text slides in after the error shake settles. */
  const feedbackProgress = interpolate(frame, [88, 98], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  /** Subtle horizontal shake on wrong answer. */
  const shakeX = frame >= 75 && frame <= 90
    ? interpolate(
        frame,
        [75, 77, 79, 81, 83, 85],
        [0, -4, 4, -3, 2, 0],
        { extrapolateRight: "clamp" },
      )
    : 0;

  return (
    <SceneContainer bg="white">
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 24,
          maxWidth: 620,
        }}
      >
        {/* Framing headline — visible immediately */}
        <span
          style={{
            fontSize: 40,
            fontWeight: 600,
            color: COLORS.text,
            textAlign: "center",
          }}
        >
          You learn by making decisions.
        </span>

        {/* Scenario text */}
        <p
          style={{
            ...scenarioStyle,
            fontSize: 20,
            lineHeight: 1.7,
            color: COLORS.muted,
            fontWeight: 400,
            fontStyle: "italic",
            textAlign: "center",
            margin: 0,
          }}
        >
          {SCENARIO}
        </p>

        {/* Choice cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%", marginTop: 8 }}>
          {CHOICES.map((choice, index) => {
            const delay = stagger({ index, baseDelay: 24, gap: 6 });
            const choiceStyle = entryScale({ frame, delay });

            const isWrong = index === WRONG_INDEX;
            const isCorrect = index === CORRECT_INDEX;

            const { borderColor, bgColor, badgeBorder, badgeBg, badgeColor, textWeight } =
              getChoiceStyles({
                isWrong,
                isCorrect,
                wrongProgress,
                errorProgress,
                correctProgress,
              });

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
                  <span
                    style={{
                      fontSize: 17,
                      fontWeight: textWeight,
                      color: COLORS.text,
                    }}
                  >
                    {choice}
                  </span>
                </div>

                {/* Feedback message — appears after wrong answer */}
                {isWrong && feedbackProgress > 0 && (
                  <div
                    style={{
                      ...entryScale({ frame, delay: 88, duration: 10 }),
                      paddingLeft: 22,
                      paddingRight: 22,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 400,
                        color: COLORS.muted,
                        lineHeight: 1.5,
                      }}
                    >
                      Recalibrating won't help — the inconsistency is caused by
                      how the measurement is done, not the sensors themselves.
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

/**
 * Returns the visual style for each choice card based on the current
 * animation phase (neutral → wrong selected → error shown → correct selected).
 */
function getChoiceStyles({
  isWrong,
  isCorrect,
  wrongProgress,
  errorProgress,
  correctProgress,
}: {
  isWrong: boolean;
  isCorrect: boolean;
  wrongProgress: number;
  errorProgress: number;
  correctProgress: number;
}) {
  /** Wrong choice: neutral → selected → red error state. */
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

  /** Correct choice: neutral → green success state. */
  if (isCorrect && correctProgress > 0.5) {
    return {
      borderColor: COLORS.success,
      bgColor: "rgba(22, 163, 74, 0.04)",
      badgeBorder: COLORS.success,
      badgeBg: COLORS.success,
      badgeColor: COLORS.primaryFg,
      textWeight: 600,
    };
  }

  /** Default neutral state. */
  return {
    borderColor: COLORS.border,
    bgColor: "transparent",
    badgeBorder: COLORS.border,
    badgeBg: "transparent",
    badgeColor: COLORS.muted,
    textWeight: 400,
  };
}
