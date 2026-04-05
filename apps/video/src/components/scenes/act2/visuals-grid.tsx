import { SceneContainer } from "@/components/scene-container";
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

/**
 * All 9 visual types Zoonk can generate, in a 3x3 grid.
 * The grid IS the statement — no headline needed.
 * Shows abundance: "there's a whole system of visual tools."
 */
const VISUALS = [
  { icon: IconChartBar, label: "Charts" },
  { icon: IconSchema, label: "Diagrams" },
  { icon: IconTimeline, label: "Timelines" },
  { icon: IconCode, label: "Code" },
  { icon: IconMathFunction, label: "Formulas" },
  { icon: IconTable, label: "Tables" },
  { icon: IconPhoto, label: "Images" },
  { icon: IconMusic, label: "Music" },
  { icon: IconQuote, label: "Quotes" },
];

export function VisualsGrid() {
  const frame = useCurrentFrame();

  return (
    <SceneContainer bg="white">
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "40px 48px",
        }}
      >
        {VISUALS.map(({ icon: Icon, label }, index) => {
          /**
           * First icon appears instantly (index 0, no animation).
           * Remaining icons stagger in with 3-frame gaps.
           */
          const style = index === 0 ? {} : entryScale({ frame, delay: stagger({ index, baseDelay: 0, gap: 3 }) });

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
    </SceneContainer>
  );
}
