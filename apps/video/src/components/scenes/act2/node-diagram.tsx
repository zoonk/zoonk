import { SceneContainer } from "@/components/scene-container";
import { entryScale, smoothSpring } from "@/lib/animation";
import { COLORS } from "@/lib/constants";
import { useCurrentFrame, useVideoConfig } from "remotion";

const NODES = ["Observation", "Wave collapse", "Definite state"];

const NODE_WIDTH = 220;
const NODE_HEIGHT = 56;
const GAP = 80;
const ARROW_LENGTH = GAP - 20;

/**
 * Sequential concept chain drawn one node at a time:
 * "Observation" -> "Wave collapse" -> "Definite state".
 * Nodes and connecting arrows animate in order.
 */
export function NodeDiagram() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const totalWidth = NODES.length * NODE_WIDTH + (NODES.length - 1) * GAP;
  const startX = -totalWidth / 2;

  return (
    <SceneContainer bg="white">
      <div
        style={{
          position: "relative",
          width: totalWidth,
          height: NODE_HEIGHT,
        }}
      >
        {NODES.map((label, index) => {
          const nodeX = index * (NODE_WIDTH + GAP);

          /** Each node appears 30 frames after the previous one. */
          const nodeDelay = index * 30;
          const nodeStyle = entryScale({ frame, delay: nodeDelay, duration: 12 });

          /**
           * Arrow draws between nodes using a spring.
           * Starts 12 frames after the preceding node appears.
           */
          const arrowDelay = nodeDelay + 12;
          const arrowProgress =
            index > 0 ? smoothSpring({ frame, fps, delay: arrowDelay - 30, durationInFrames: 18 }) : 0;

          const arrowStartX = nodeX - GAP + 10;

          return (
            <div key={label}>
              {/* Arrow (except for the first node) */}
              {index > 0 && (
                <svg
                  style={{
                    position: "absolute",
                    left: startX + arrowStartX,
                    top: NODE_HEIGHT / 2 - 1,
                    overflow: "visible",
                  }}
                  width={ARROW_LENGTH}
                  height={2}
                >
                  <line
                    x1={0}
                    y1={0}
                    x2={arrowProgress * ARROW_LENGTH}
                    y2={0}
                    stroke={COLORS.text}
                    strokeWidth={1.5}
                    opacity={arrowProgress}
                  />
                  {/* Arrowhead */}
                  <polygon
                    points={`${arrowProgress * ARROW_LENGTH - 8},-5 ${arrowProgress * ARROW_LENGTH},0 ${arrowProgress * ARROW_LENGTH - 8},5`}
                    fill={COLORS.text}
                    opacity={arrowProgress > 0.5 ? (arrowProgress - 0.5) * 2 : 0}
                  />
                </svg>
              )}

              {/* Node box */}
              <div
                style={{
                  ...nodeStyle,
                  position: "absolute",
                  left: startX + nodeX,
                  top: 0,
                  width: NODE_WIDTH,
                  height: NODE_HEIGHT,
                  borderRadius: 12,
                  border: `1.5px solid ${COLORS.border}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span
                  style={{
                    fontSize: 20,
                    fontWeight: 500,
                    color: COLORS.text,
                  }}
                >
                  {label}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </SceneContainer>
  );
}
