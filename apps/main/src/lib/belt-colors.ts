import { BELT_COLORS_ORDER, type BeltColor } from "@zoonk/utils/belt-level";
import { getExtracted } from "next-intl/server";

type BeltColorOption = { bgClass: string; key: BeltColor; label: string };

export const BELT_BG_CLASSES: Record<BeltColor, string> = {
  black: "bg-belt-black",
  blue: "bg-belt-blue",
  brown: "bg-belt-brown",
  gray: "bg-belt-gray",
  green: "bg-belt-green",
  orange: "bg-belt-orange",
  purple: "bg-belt-purple",
  red: "bg-belt-red",
  white: "bg-belt-white",
  yellow: "bg-belt-yellow",
};

/**
 * The progression dots and visible level copy share these options so every belt
 * color uses the same translated full label.
 */
export async function getBeltColors(): Promise<BeltColorOption[]> {
  const t = await getExtracted();

  return BELT_COLORS_ORDER.map((key) => ({
    bgClass: BELT_BG_CLASSES[key],
    key,
    label: t(
      "{color, select, white {White Belt} yellow {Yellow Belt} orange {Orange Belt} green {Green Belt} blue {Blue Belt} purple {Purple Belt} brown {Brown Belt} red {Red Belt} gray {Gray Belt} black {Black Belt} other {Belt}}",
      { color: key },
    ),
  }));
}

/**
 * Call sites that only render the current belt still read from the shared belt
 * options so belt copy cannot drift from the progression labels.
 */
export async function getBeltLabel({ color }: { color: BeltColor }): Promise<string> {
  const beltColors = await getBeltColors();

  return beltColors.find((belt) => belt.key === color)?.label ?? color;
}
