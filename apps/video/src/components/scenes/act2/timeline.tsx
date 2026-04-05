import { SceneContainer } from "@/components/scene-container";
import { entryScale, smoothSpring } from "@/lib/animation";
import { COLORS } from "@/lib/constants";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";

const MILESTONES = ["Planck", "Bohr", "Heisenberg", "Schrödinger", "Bell"];

const LINE_WIDTH = 800;
const LINE_Y = 200;
const NODE_RADIUS = 10;
const LABEL_OFFSET = 32;

/**
 * A horizontal timeline that draws itself from left to right.
 * Milestone nodes appear as the line reaches them.
 * Shows the AI-generated course structure as a visual progression.
 */
export function Timeline() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  /** Line draws over 90 frames (3 seconds) with a smooth spring. */
  const lineProgress = smoothSpring({ frame, fps, delay: 12, durationInFrames: 90 });
  const drawnWidth = lineProgress * LINE_WIDTH;

  return (
    <SceneContainer bg="white">
      <div style={entryScale({ frame, delay: 0, duration: 12 })}>
        <svg
          width={LINE_WIDTH + 40}
          height={400}
          viewBox={`0 0 ${LINE_WIDTH + 40} 400`}
          style={{ overflow: "visible" }}
        >
          {/* Background track (faint) */}
          <line
            x1={20}
            y1={LINE_Y}
            x2={LINE_WIDTH + 20}
            y2={LINE_Y}
            stroke={COLORS.border}
            strokeWidth={2}
          />

          {/* Drawn line (dark, progresses L->R) */}
          <line
            x1={20}
            y1={LINE_Y}
            x2={20 + drawnWidth}
            y2={LINE_Y}
            stroke={COLORS.text}
            strokeWidth={2}
            strokeLinecap="round"
          />

          {/* Milestone nodes + labels */}
          {MILESTONES.map((label, index) => {
            const nodeX = 20 + (index / (MILESTONES.length - 1)) * LINE_WIDTH;

            /** Node appears when the drawn line reaches its position. */
            const nodeThreshold = (index / (MILESTONES.length - 1)) * LINE_WIDTH;
            const isReached = drawnWidth >= nodeThreshold;
            const nodeOpacity = isReached
              ? interpolate(
                  drawnWidth - nodeThreshold,
                  [0, 30],
                  [0, 1],
                  { extrapolateRight: "clamp" },
                )
              : 0;

            /** Label fades in 6 frames after the node. */
            const labelOpacity = isReached
              ? interpolate(
                  drawnWidth - nodeThreshold,
                  [15, 45],
                  [0, 1],
                  { extrapolateRight: "clamp" },
                )
              : 0;

            return (
              <g key={label}>
                <circle
                  cx={nodeX}
                  cy={LINE_Y}
                  r={NODE_RADIUS}
                  fill={COLORS.text}
                  opacity={nodeOpacity}
                />
                <text
                  x={nodeX}
                  y={LINE_Y + LABEL_OFFSET}
                  textAnchor="middle"
                  fill={COLORS.muted}
                  fontSize={16}
                  fontWeight={500}
                  fontFamily="Geist, system-ui, sans-serif"
                  opacity={labelOpacity}
                >
                  {label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </SceneContainer>
  );
}
