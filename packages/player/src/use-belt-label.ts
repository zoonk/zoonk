"use client";

import { type BeltColor } from "@zoonk/utils/belt-level";
import { useExtracted } from "next-intl";

/**
 * Belt names need full translated labels because several languages change the
 * color word when it modifies "belt". Returning the whole label keeps milestone
 * copy from composing invalid color grammar at each call site.
 */
export function useBeltLabel(color: BeltColor): string {
  const t = useExtracted();

  return t(
    "{color, select, white {White Belt} yellow {Yellow Belt} orange {Orange Belt} green {Green Belt} blue {Blue Belt} purple {Purple Belt} brown {Brown Belt} red {Red Belt} gray {Gray Belt} black {Black Belt} other {Belt}}",
    { color },
  );
}
