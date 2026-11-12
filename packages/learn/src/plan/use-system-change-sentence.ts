import { type PlanChangeView } from "@zoonk/core/plans/view-contract";
import { useExtracted } from "next-intl";
import { useRelearnSentence } from "./use-relearn-sentence";

/** Without `id`: a change Today worked out has none until it's saved. */
export type PlanChangeContent = Omit<PlanChangeView, "id">;

/** A change the plan made by itself says why in one sentence; what moved is the change's effect. */
export function useSystemChangeSentence() {
  const t = useExtracted();
  const relearnSentence = useRelearnSentence();

  return function systemChangeSentence(change: PlanChangeContent): string | null {
    switch (change.kind) {
      case "missedDays":
        return t("Your plan moved to fit the days you missed.");
      case "estimateUpdated":
        return change.effect &&
          change.effect.lessonsAdded !== change.effect.lessonsRemoved
          ? t("Your plan changed to match the time your lessons take.")
          : null;
      case "testedOut":
        return t(
          "{lessons, plural, one {You passed the test, so your plan skips # lesson.} other {You passed the test, so your plan skips # lessons.}}",
          { lessons: change.lessonsSkipped },
        );
      case "relearn":
        return relearnSentence(change);
      case "coverageChanged":
        return change.effect?.fromPlacement
          ? t("Your test answers changed your plan.")
          : t("Your plan changed.");
      default:
        return null;
    }
  };
}
