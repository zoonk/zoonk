import type { BeltColor } from "@zoonk/utils/belt-level";
import { getExtracted } from "next-intl/server";

export type BeltColorInfo = {
  bgClass: string;
  key: BeltColor;
  label: string;
};

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

export async function getBeltColors(params?: {
  locale: string;
}): Promise<BeltColorInfo[]> {
  const t = await getExtracted(params);

  return [
    { bgClass: BELT_BG_CLASSES.white, key: "white", label: t("White") },
    { bgClass: BELT_BG_CLASSES.yellow, key: "yellow", label: t("Yellow") },
    { bgClass: BELT_BG_CLASSES.orange, key: "orange", label: t("Orange") },
    { bgClass: BELT_BG_CLASSES.green, key: "green", label: t("Green") },
    { bgClass: BELT_BG_CLASSES.blue, key: "blue", label: t("Blue") },
    { bgClass: BELT_BG_CLASSES.purple, key: "purple", label: t("Purple") },
    { bgClass: BELT_BG_CLASSES.brown, key: "brown", label: t("Brown") },
    { bgClass: BELT_BG_CLASSES.red, key: "red", label: t("Red") },
    { bgClass: BELT_BG_CLASSES.gray, key: "gray", label: t("Gray") },
    { bgClass: BELT_BG_CLASSES.black, key: "black", label: t("Black") },
  ];
}

export async function getBeltColorLabel(
  color: BeltColor,
  opts?: { locale: string },
): Promise<string> {
  const colors = await getBeltColors(opts);
  return colors.find((c) => c.key === color)?.label ?? "";
}
