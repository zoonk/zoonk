import { SceneContainer } from "@/components/scene-container";
import { Img, interpolate, staticFile, useCurrentFrame } from "remotion";

/**
 * Zoonk icon/logo centered on white. No text.
 * Identity beat — "here is who we are."
 */
export function Logo() {
  const frame = useCurrentFrame();

  const opacity = interpolate(frame, [0, 5], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <SceneContainer bg="white">
      <Img src={staticFile("images/icon.svg")} style={{ width: 120, height: 120, opacity }} />
    </SceneContainer>
  );
}
