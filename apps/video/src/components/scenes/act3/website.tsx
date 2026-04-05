import { SceneContainer } from "@/components/scene-container";
import { COLORS } from "@/lib/constants";
import { interpolate, useCurrentFrame } from "remotion";

/**
 * "zoonk.com" — centered, clean, understated.
 * The destination beat — "here is where to find us."
 */
export function Website() {
  const frame = useCurrentFrame();

  const opacity = interpolate(frame, [0, 3], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <SceneContainer bg="white">
      <span
        style={{
          fontSize: 48,
          fontWeight: 500,
          color: COLORS.text,
          opacity,
        }}
      >
        zoonk.com
      </span>
    </SceneContainer>
  );
}
