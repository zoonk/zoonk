"use client";

import { type BeltColor } from "@zoonk/utils/belt-level";
import { useExtracted } from "next-intl";

export function useBeltLabel(color: BeltColor): string {
  const t = useExtracted();

  return t(
    "{color, select, white {White belt} yellow {Yellow belt} orange {Orange belt} green {Green belt} blue {Blue belt} purple {Purple belt} brown {Brown belt} red {Red belt} gray {Gray belt} black {Black belt} other {Belt}}",
    { color },
  );
}
