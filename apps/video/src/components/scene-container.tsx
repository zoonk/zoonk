import { COLORS } from "@/lib/constants";
import { FONT_FAMILY } from "@/lib/fonts";
import { AbsoluteFill } from "remotion";

/**
 * Wrapper that provides the alternating black/white background
 * and centers child content for every scene in the video.
 */
export function SceneContainer({
  bg,
  children,
}: {
  bg: "black" | "white";
  children: React.ReactNode;
}) {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: bg === "black" ? COLORS.black : COLORS.white,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: FONT_FAMILY,
      }}
    >
      {children}
    </AbsoluteFill>
  );
}
