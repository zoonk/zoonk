import { SceneContainer } from "@/components/scene-container";
import { SceneHeadline } from "@/components/scene-headline";
import { entryScale, stagger } from "@/lib/animation";
import { COLORS } from "@/lib/constants";
import {
  IconChartBar,
  IconCode,
  IconMathFunction,
  IconMusic,
  IconPhoto,
  IconQuote,
  IconSchema,
  IconTable,
  IconTimeline,
} from "@tabler/icons-react";
import { useCurrentFrame } from "remotion";
import { useT } from "../../use-translations";

/**
 * "Charts. Diagrams. Timelines." (headline, word-by-word)
 * → "And more." (payoff)
 * → 3x3 icon grid showing all 9 visual types.
 *
 * Replaces the old montage — the grid communicates breadth
 * far more efficiently than stepping through individual types.
 */
export function VisualsGrid() {
  const frame = useCurrentFrame();
  const t = useT();

  const visuals = [
    { icon: IconChartBar, label: t.gridLabels.charts },
    { icon: IconSchema, label: t.gridLabels.diagrams },
    { icon: IconTimeline, label: t.gridLabels.timelines },
    { icon: IconCode, label: t.gridLabels.code },
    { icon: IconMathFunction, label: t.gridLabels.formulas },
    { icon: IconTable, label: t.gridLabels.tables },
    { icon: IconPhoto, label: t.gridLabels.images },
    { icon: IconMusic, label: t.gridLabels.music },
    { icon: IconQuote, label: t.gridLabels.quotes },
  ];

  /** Grid starts after the headline has settled (~50 frames). */
  const gridBaseDelay = 50;

  return (
    <SceneContainer bg="white">
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 40,
        }}
      >
        <SceneHeadline setup={t.gridSetup} payoff={t.gridPayoff} payoffStartFrame={18} />

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "40px 48px",
            ...entryScale({ frame, delay: gridBaseDelay, duration: 12 }),
          }}
        >
          {visuals.map(({ icon: Icon, label }, index) => {
            const style =
              index === 0
                ? {}
                : entryScale({
                    frame,
                    delay: stagger({ index, baseDelay: gridBaseDelay, gap: 5 }),
                  });

            return (
              <div
                key={label}
                style={{
                  ...style,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <Icon size={44} stroke={1.5} color={COLORS.text} />
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: COLORS.muted,
                    textTransform: "uppercase" as const,
                    letterSpacing: "0.05em",
                  }}
                >
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </SceneContainer>
  );
}
