"use client";

import { usePathname } from "@/i18n/navigation";
import { getMenu } from "@/lib/menu";
import { type LearnerSummaryPlaces } from "@zoonk/core/learner/summary/contract";

/**
 * The places the frame lists: the summary's, with Saved lessons while it's the page shown, as on
 * iOS and Android: removing the last save there takes the place away once the learner leaves.
 */
export function useListedPlaces(places: LearnerSummaryPlaces): LearnerSummaryPlaces {
  const shown = usePathname() === getMenu("savedLessons").url;
  return shown && !places.savedLessons ? { ...places, savedLessons: true } : places;
}
