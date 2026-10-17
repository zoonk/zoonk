import { beltColorClasses } from "@zoonk/ui/components/belt-indicator";
import { BELT_COLORS_ORDER, type BeltColor } from "@zoonk/utils/belt-level";
import { getExtracted } from "next-intl/server";

type BeltColorOption = { bgClass: string; key: BeltColor; label: string };

/**
 * The progression dots and visible level copy share these options so every belt
 * color uses the same translated full label.
 */
export async function getBeltColors(): Promise<BeltColorOption[]> {
  const t = await getExtracted();

  return BELT_COLORS_ORDER.map((key) => ({
    bgClass: beltColorClasses[key],
    key,
    label: t(
      "{color, select, white {White belt} yellow {Yellow belt} orange {Orange belt} green {Green belt} blue {Blue belt} purple {Purple belt} brown {Brown belt} red {Red belt} gray {Gray belt} black {Black belt} other {Belt}}",
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
