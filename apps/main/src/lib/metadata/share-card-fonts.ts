import "server-only";
import { readLatinFonts } from "@/lib/certificates/certificate-fonts";

/**
 * A link's share card: its words, and the brand and title in the brand's weight. Read while the
 * module loads: Next doesn't wait for a file read when it prerenders a card, and a card still
 * waiting on one is silently left to render on every request. Words in a script Geist doesn't draw
 * are fetched as `next/og` does without fonts of its own.
 */
export const shareCardFonts = await readLatinFonts(
  new Set(["Geist-400.ttf", "Geist-640.ttf", "NotoSans-400.ttf"]),
);
