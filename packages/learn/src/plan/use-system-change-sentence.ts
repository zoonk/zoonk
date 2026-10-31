import { type PlanChangeView } from "@zoonk/core/plans/view-contract";
import { useExtracted } from "next-intl";
import { useCoverageSentence, useTopicsMovedSentence } from "./use-coverage-sentence";
import { useEstimateSentence } from "./use-estimate-sentence";
import { usePhaseEndsText } from "./use-phase-ends-text";
import { useRelearnSentence } from "./use-relearn-sentence";

/** Without `id`: a change Today worked out has none until it's saved. */
export type PlanChangeContent = Omit<PlanChangeView, "id">;

export function useSystemChangeSentence({
  targetDate = null,
}: { targetDate?: string | null } = {}) {
  const t = useExtracted();
  const relearnSentence = useRelearnSentence();
  const coverageSentence = useCoverageSentence();
  const topicsMoved = useTopicsMovedSentence();
  const phaseEndsText = usePhaseEndsText();
  const estimateSentence = useEstimateSentence({ targetDate });

  const withTopics = (sentence: string, change: PlanChangeContent, added = true): string =>
    [sentence, topicsMoved(change, { added })].filter(Boolean).join(" ");

  return function systemChangeSentence(change: PlanChangeContent): string | null {
    switch (change.kind) {
      case "missedDays":
        return withTopics(
          [
            t("Lessons left from earlier days come first, and the rest of your plan moved later."),
            phaseEndsText(change.effect),
          ]
            .filter(Boolean)
            .join(" "),
          change,
        );
      case "estimateUpdated":
        return (
          [estimateSentence(change.effect), phaseEndsText(change.effect)]
            .filter(Boolean)
            .join(" ") || null
        );
      case "testedOut":
        return withTopics(
          t(
            "{lessons, plural, one {You tested out of # lesson} other {You tested out of # lessons}}, so it's off your plan.",
            { lessons: change.lessonsSkipped },
          ),
          change,
        );
      // Its own sentence names the topics it brings back.
      case "relearn":
        return withTopics(relearnSentence(change), change, false);
      case "coverageChanged":
        return coverageSentence(change);
      default:
        return null;
    }
  };
}
