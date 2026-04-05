import { SceneContainer } from "@/components/scene-container";
import { entryScale } from "@/lib/animation";
import { COLORS } from "@/lib/constants";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";

const DENSE_TEXT =
  "Wave-particle duality describes the phenomenon wherein quantum entities " +
  "exhibit properties of both waves and particles, as demonstrated by " +
  "interference patterns observed in the double-slit experiment, challenging " +
  "classical notions of deterministic trajectories and raising fundamental " +
  "questions about the nature of measurement in quantum mechanical systems.";

/**
 * Dense academic text in a subtle external frame — the "before" moment.
 * Light desaturated frame with faint browser chrome signals
 * "this is from out there." Blurs out in the last half to yield
 * to the clean Zoonk card in the next scene.
 */
export function StatusQuo() {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const containerStyle = entryScale({ frame, delay: 0, duration: 12 });

  /** Blur increases in the second half of the scene to set up the transition. */
  const blur = interpolate(frame, [durationInFrames * 0.5, durationInFrames], [0, 6], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const scale = interpolate(frame, [durationInFrames * 0.5, durationInFrames], [1, 0.97], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <SceneContainer bg="white">
      <div
        style={{
          ...containerStyle,
          filter: `blur(${blur}px)`,
          transform: `scale(${scale})`,
        }}
      >
        {/* Subtle external frame — signals "not your product" */}
        <div
          style={{
            width: 700,
            backgroundColor: "#f0f0f0",
            border: `1px solid ${COLORS.border}`,
            borderRadius: 12,
            padding: "40px 44px",
          }}
        >
          {/* Faint browser-like top bar */}
          <div
            style={{
              display: "flex",
              gap: 6,
              marginBottom: 24,
              opacity: 0.4,
            }}
          >
            <div
              style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.muted }}
            />
            <div
              style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.muted }}
            />
            <div
              style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.muted }}
            />
          </div>

          <p
            style={{
              fontSize: 15,
              lineHeight: 1.9,
              color: COLORS.muted,
              textAlign: "justify",
              margin: 0,
              fontWeight: 400,
            }}
          >
            {DENSE_TEXT}
          </p>
        </div>
      </div>
    </SceneContainer>
  );
}
