"use client";

import { type ProgressView } from "@zoonk/core/view-models/progress/get";
import { useExtracted } from "next-intl";

type Stage = NonNullable<ProgressView["preparation"]>["stage"];

/**
 * Honest stage names in the ring's order (Warming up, Getting there, Solid): the last one is
 * "Solid", never a promise of a pass.
 */
export function useStageName() {
  const t = useExtracted();

  return (stage: Stage): string => {
    switch (stage) {
      case "building":
        return t("Warming up");
      case "growing":
        return t("Getting there");
      case "solid":
        return t("Solid");
      case "starting":
        return t("Just started");
      default:
        return t("Just started");
    }
  };
}
