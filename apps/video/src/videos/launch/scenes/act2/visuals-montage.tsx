import { SceneContainer } from "@/components/scene-container";
import { entryScale, smoothSpring } from "@/lib/animation";
import { COLORS } from "@/lib/constants";
import { Easing, Sequence, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { useT } from "../../use-translations";

const FRAMES_PER_VISUAL = 60;

/**
 * Fast montage of visual types: Timeline, Diagram, Chart.
 * Each gets ~2 seconds. A label at the top cycles to identify each type.
 * This communicates "look at all the ways Zoonk visualizes concepts."
 */
export function VisualsMontage() {
  return (
    <SceneContainer bg="white">
      <Sequence from={0} durationInFrames={FRAMES_PER_VISUAL} layout="none">
        <TimelineVisual />
      </Sequence>
      <Sequence from={FRAMES_PER_VISUAL} durationInFrames={FRAMES_PER_VISUAL} layout="none">
        <DiagramVisual />
      </Sequence>
      <Sequence from={FRAMES_PER_VISUAL * 2} durationInFrames={FRAMES_PER_VISUAL} layout="none">
        <ChartVisual />
      </Sequence>
    </SceneContainer>
  );
}

function VisualLabel({ text }: { text: string }) {
  const frame = useCurrentFrame();
  const style = entryScale({ frame, delay: 0, duration: 8 });

  return (
    <span
      style={{
        ...style,
        position: "absolute",
        top: 160,
        left: "50%",
        transform: `translateX(-50%) ${style.transform}`,
        fontSize: 16,
        fontWeight: 500,
        color: COLORS.muted,
        letterSpacing: "0.05em",
        textTransform: "uppercase" as const,
      }}
    >
      {text}
    </span>
  );
}

function TimelineVisual() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = useT();

  const lineWidth = 600;
  const lineY = 50;
  const nodes = ["Planck", "Bohr", "Heisenberg"];
  const progress = smoothSpring({ frame, fps, delay: 10, durationInFrames: 40 });
  const drawnWidth = progress * lineWidth;

  return (
    <>
      <VisualLabel text={t.labelTimelines} />
      <div style={{ ...entryScale({ frame, delay: 0, duration: 12 }), marginTop: 80 }}>
        <svg width={lineWidth + 40} height={120} viewBox={`0 0 ${lineWidth + 40} 120`}>
          <line
            x1={20}
            y1={lineY}
            x2={lineWidth + 20}
            y2={lineY}
            stroke={COLORS.border}
            strokeWidth={2}
          />
          <line
            x1={20}
            y1={lineY}
            x2={20 + drawnWidth}
            y2={lineY}
            stroke={COLORS.text}
            strokeWidth={2}
            strokeLinecap="round"
          />
          {nodes.map((label, i) => {
            const nodeX = 20 + (i / (nodes.length - 1)) * lineWidth;
            const threshold = (i / (nodes.length - 1)) * lineWidth;
            const opacity =
              drawnWidth >= threshold
                ? interpolate(drawnWidth - threshold, [0, 30], [0, 1], {
                    extrapolateRight: "clamp",
                  })
                : 0;

            return (
              <g key={label}>
                <circle cx={nodeX} cy={lineY} r={8} fill={COLORS.text} opacity={opacity} />
                <text
                  x={nodeX}
                  y={lineY + 28}
                  textAnchor="middle"
                  fill={COLORS.muted}
                  fontSize={14}
                  fontWeight={500}
                  fontFamily="Geist, system-ui, sans-serif"
                  opacity={opacity}
                >
                  {label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </>
  );
}

function DiagramVisual() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = useT();

  const nodes = t.diagramNodes;
  const nodeWidth = 180;
  const gap = 60;
  const totalWidth = nodes.length * nodeWidth + (nodes.length - 1) * gap;

  return (
    <>
      <VisualLabel text={t.labelDiagrams} />
      <div style={{ position: "relative", width: totalWidth, height: 56, marginTop: 80 }}>
        {nodes.map((label, i) => {
          const nodeStyle = entryScale({ frame, delay: i * 15, duration: 12 });
          const arrowProgress =
            i > 0 ? smoothSpring({ frame, fps, delay: i * 15 - 5, durationInFrames: 15 }) : 0;
          const nodeX = i * (nodeWidth + gap);
          const arrowX = nodeX - gap + 8;

          return (
            <div key={label}>
              {i > 0 && (
                <svg
                  style={{ position: "absolute", left: arrowX, top: 26, overflow: "visible" }}
                  width={gap - 16}
                  height={2}
                >
                  <line
                    x1={0}
                    y1={0}
                    x2={arrowProgress * (gap - 16)}
                    y2={0}
                    stroke={COLORS.text}
                    strokeWidth={1.5}
                    opacity={arrowProgress}
                  />
                  <polygon
                    points={`${arrowProgress * (gap - 16) - 6},-4 ${arrowProgress * (gap - 16)},0 ${arrowProgress * (gap - 16) - 6},4`}
                    fill={COLORS.text}
                    opacity={arrowProgress > 0.5 ? 1 : 0}
                  />
                </svg>
              )}
              <div
                style={{
                  ...nodeStyle,
                  position: "absolute",
                  left: nodeX,
                  top: 0,
                  width: nodeWidth,
                  height: 56,
                  borderRadius: 12,
                  border: `1.5px solid ${COLORS.border}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 16,
                  fontWeight: 500,
                  color: COLORS.text,
                }}
              >
                {label}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function ChartVisual() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = useT();

  const bars = [
    { label: "Classical", height: 120, color: COLORS.border },
    { label: "Quantum", height: 200, color: COLORS.bpBlue },
    { label: "String", height: 80, color: COLORS.border },
  ];

  return (
    <>
      <VisualLabel text={t.labelCharts} />
      <div style={{ display: "flex", alignItems: "flex-end", gap: 32, marginTop: 80 }}>
        {bars.map((bar, i) => {
          const progress = smoothSpring({ frame, fps, delay: 8 + i * 6, durationInFrames: 30 });
          return (
            <div
              key={bar.label}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}
            >
              <div
                style={{
                  width: 64,
                  height: bar.height * progress,
                  borderRadius: 8,
                  backgroundColor: bar.color,
                }}
              />
              <span style={{ fontSize: 13, fontWeight: 500, color: COLORS.muted }}>
                {bar.label}
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
}
