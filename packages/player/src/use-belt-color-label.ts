"use client";

import { type BeltColor } from "@zoonk/utils/belt-level";
import { useExtracted } from "next-intl";

export function useBeltColorLabel(color: BeltColor): string {
  const t = useExtracted();

  const labels: Record<BeltColor, string> = {
    black: t("Black"),
    blue: t("Blue"),
    brown: t("Brown"),
    gray: t("Gray"),
    green: t("Green"),
    orange: t("Orange"),
    purple: t("Purple"),
    red: t("Red"),
    white: t("White"),
    yellow: t("Yellow"),
  };

  return labels[color];
}
