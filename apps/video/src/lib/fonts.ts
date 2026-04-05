import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

/**
 * Loads the Geist Sans and Geist Mono fonts from local files.
 * Call this at the top of Root.tsx so fonts are available everywhere.
 */
export async function loadGeistFonts() {
  await Promise.all([
    loadFont({
      family: "Geist",
      url: staticFile("fonts/Geist-Regular.woff2"),
      weight: "400",
    }),
    loadFont({
      family: "Geist",
      url: staticFile("fonts/Geist-Medium.woff2"),
      weight: "500",
    }),
    loadFont({
      family: "Geist",
      url: staticFile("fonts/Geist-SemiBold.woff2"),
      weight: "600",
    }),
    loadFont({
      family: "Geist",
      url: staticFile("fonts/Geist-Bold.woff2"),
      weight: "700",
    }),
    loadFont({
      family: "Geist Mono",
      url: staticFile("fonts/GeistMono-Regular.woff2"),
      weight: "400",
    }),
  ]);
}

export const FONT_FAMILY = "Geist, system-ui, sans-serif";
