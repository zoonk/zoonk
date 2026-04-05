import { SceneContainer } from "@/components/scene-container";
import { COLORS } from "@/lib/constants";
import { Easing, interpolate, useCurrentFrame } from "remotion";

/**
 * Zoonk wordmark fades in. Centered. Alone.
 * No scale animation — should feel like it was always there,
 * just becoming visible. The logo IS the statement at this point.
 */
export function Logo() {
  const frame = useCurrentFrame();

  const logoOpacity = interpolate(frame, [0, 18], [0, 1], {
    easing: Easing.out(Easing.quad),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const urlOpacity = interpolate(frame, [12, 24], [0, 1], {
    easing: Easing.out(Easing.quad),
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
          gap: 16,
        }}
      >
        <span
          style={{
            fontSize: 56,
            fontWeight: 700,
            color: COLORS.text,
            opacity: logoOpacity,
            letterSpacing: "-0.02em",
          }}
        >
          zoonk
        </span>

        <span
          style={{
            fontSize: 18,
            fontWeight: 400,
            color: COLORS.muted,
            opacity: urlOpacity,
          }}
        >
          zoonk.com
        </span>
      </div>
    </SceneContainer>
  );
}
