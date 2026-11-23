import { type PlanChangeView } from "@zoonk/core/plans/view-contract";
import { useExtracted } from "next-intl";
import { useRelearnSentence } from "./use-relearn-sentence";

/** Without `id`: a change Today worked out has none until it's saved. */
export type PlanChangeContent = Omit<PlanChangeView, "id">;

/** A change the plan made by itself says why in one sentence; what moved is the change's effect. */
export function useSystemChangeSentence() {
  const t = useExtracted();
  const relearnSentence = useRelearnSentence();

  const skippedSentence = (lessons: number) =>
    t(
      "{lessons, plural, one {Skipped # lesson you already know.} other {Skipped # lessons you already know.}}",
      { lessons },
    );

  return function systemChangeSentence(change: PlanChangeContent): string | null {
    switch (change.kind) {
      case "missedDays":
        return t("Your plan changed to make up for the days you missed.");
      case "estimateUpdated":
        return change.effect && change.effect.lessonsAdded !== change.effect.lessonsRemoved
          ? t("Your plan changed to match the time your lessons take.")
          : null;
      case "testedOut":
        return skippedSentence(change.lessonsSkipped);
      case "relearn":
        return change.lessonsSkipped > 0
          ? t({
              description:
                "One day's plan change: {skipped} says the lessons it skipped, {back} the topics that came back.",
              message: "{skipped} {back}",
              values: {
                back: relearnSentence(change),
                skipped: skippedSentence(change.lessonsSkipped),
              },
            })
          : relearnSentence(change);
      case "coverageChanged":
        return change.effect?.fromPlacement
          ? t("Your test answers changed your plan.")
          : t("Your plan changed.");
      default:
        return null;
    }
  };
}
