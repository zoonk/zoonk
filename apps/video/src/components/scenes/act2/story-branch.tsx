import { SceneContainer } from "@/components/scene-container";
import { SceneHeadline } from "@/components/scene-headline";
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
 * "You learn" (instant) → "by making decisions." (word by word, muted)
 * → scenario + choices → wrong answer → feedback → correct answer.
 */
export function StoryBranch() {
  const frame = useCurrentFrame();

  const scenarioStyle = entryScale({ frame, delay: 35, duration: 12 });

  const wrongProgress = interpolate(frame, [85, 95], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const errorProgress = interpolate(frame, [95, 105], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const feedbackProgress = interpolate(frame, [108, 118], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const correctProgress = interpolate(frame, [130, 140], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const shakeX = frame >= 95 && frame <= 110
    ? interpolate(frame, [95, 97, 99, 101, 103, 105], [0, -4, 4, -3, 2, 0], {
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
          gap: 24,
          maxWidth: 620,
        }}
      >
        <SceneHeadline
          setup="You learn"
          payoff="by making decisions."
          payoffStartFrame={15}
        />

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
            const delay = stagger({ index, baseDelay: 48, gap: 6 });
            const choiceStyle = entryScale({ frame, delay });

            const isWrong = index === WRONG_INDEX;
            const isCorrect = index === CORRECT_INDEX;

            const { borderColor, bgColor, badgeBorder, badgeBg, badgeColor, textWeight } =
              getChoiceStyles({ isWrong, isCorrect, wrongProgress, errorProgress, correctProgress });

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

                {isWrong && feedbackProgress > 0 && (
                  <div
                    style={{
                      ...entryScale({ frame, delay: 108, duration: 10 }),
                      paddingLeft: 22,
                      paddingRight: 22,
                    }}
                  >
                    <span style={{ fontSize: 14, fontWeight: 400, color: COLORS.muted, lineHeight: 1.5 }}>
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

  return {
    borderColor: COLORS.border,
    bgColor: "transparent",
    badgeBorder: COLORS.border,
    badgeBg: "transparent",
    badgeColor: COLORS.muted,
    textWeight: 400,
  };
}
