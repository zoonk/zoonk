"use client";

import { useExtracted } from "next-intl";
import { useCallback } from "react";

/**
 * Returns a function that translates state tier labels (Thriving, Healthy,
 * Stable, Stressed, Critical) into the user's language.
 *
 * Centralizes all tier label translations so they live in one place
 * instead of being duplicated across components.
 */
export function useStateTierLabel(): (label: string) => string {
  const t = useExtracted();

  return useCallback(
    (label: string) => {
      if (label === "Critical") {
        return t("Critical");
      }
      if (label === "Healthy") {
        return t("Healthy");
      }
      if (label === "Stable") {
        return t("Stable");
      }
      if (label === "Stressed") {
        return t("Stressed");
      }
      if (label === "Thriving") {
        return t("Thriving");
      }
      return label;
    },
    [t],
  );
}
