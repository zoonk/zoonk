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

const SELECTED_INDEX = 1;

/**
 * Story branch: a practical scenario with three choices.
 * The middle choice highlights after a beat, showing
 * how learners make decisions rather than memorize definitions.
 */
export function StoryBranch() {
  const frame = useCurrentFrame();
  const scenarioStyle = entryScale({ frame, delay: 0, duration: 12 });

  /** The selected choice highlights between frames 70-82. */
  const selectionProgress = interpolate(frame, [70, 82], [0, 1], {
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
          gap: 32,
          maxWidth: 600,
        }}
      >
        {/* Scenario text */}
        <p
          style={{
            ...scenarioStyle,
            fontSize: 22,
            lineHeight: 1.7,
            color: COLORS.text,
            fontWeight: 400,
            fontStyle: "italic",
            textAlign: "center",
            margin: 0,
          }}
        >
          {SCENARIO}
        </p>

        {/* Choice cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%" }}>
          {CHOICES.map((choice, index) => {
            const delay = stagger({ index, baseDelay: 18, gap: 6 });
            const choiceStyle = entryScale({ frame, delay });

            const isSelected = index === SELECTED_INDEX;
            const borderColor = isSelected && selectionProgress > 0.5
              ? COLORS.primary
              : COLORS.border;
            const bgColor = isSelected
              ? `rgba(23, 23, 23, ${selectionProgress * 0.04})`
              : "transparent";

            return (
              <div
                key={choice}
                style={{
                  ...choiceStyle,
                  padding: "18px 24px",
                  borderRadius: 12,
                  border: `1.5px solid ${borderColor}`,
                  backgroundColor: bgColor,
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                }}
              >
                <span
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    border: `1.5px solid ${isSelected && selectionProgress > 0.5 ? COLORS.primary : COLORS.border}`,
                    backgroundColor: isSelected && selectionProgress > 0.5
                      ? COLORS.primary
                      : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 13,
                    fontWeight: 600,
                    color: isSelected && selectionProgress > 0.5 ? COLORS.primaryFg : COLORS.muted,
                    flexShrink: 0,
                  }}
                >
                  {String.fromCharCode(65 + index)}
                </span>
                <span
                  style={{
                    fontSize: 18,
                    fontWeight: isSelected && selectionProgress > 0.5 ? 600 : 400,
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
