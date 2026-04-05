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
 * "You learn by making decisions."
 *
 * A framing headline explains what the viewer is seeing,
 * then a practical scenario with three choices appears below.
 * The middle choice highlights after a beat.
 */
export function StoryBranch() {
  const frame = useCurrentFrame();

  const headlineStyle = entryScale({ frame, delay: 0, duration: 12 });
  const scenarioStyle = entryScale({ frame, delay: 12, duration: 12 });

  /** The selected choice highlights between frames 80-92. */
  const selectionProgress = interpolate(frame, [80, 92], [0, 1], {
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
          maxWidth: 620,
        }}
      >
        {/* Framing headline */}
        <span
          style={{
            ...headlineStyle,
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
                    border: `1.5px solid ${isSelected && selectionProgress > 0.5 ? COLORS.primary : COLORS.border}`,
                    backgroundColor: isSelected && selectionProgress > 0.5
                      ? COLORS.primary
                      : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    fontWeight: 600,
                    color: isSelected && selectionProgress > 0.5 ? COLORS.primaryFg : COLORS.muted,
                    flexShrink: 0,
                  }}
                >
                  {String.fromCharCode(65 + index)}
                </span>
                <span
                  style={{
                    fontSize: 17,
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
