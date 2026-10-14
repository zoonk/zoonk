import { type PlanChangeView } from "@zoonk/core/plans/view-contract";
import { useExtracted } from "next-intl";
import { useCoverageSentence, useTopicsMovedSentence } from "./use-coverage-sentence";
import { useEstimateSentence } from "./use-estimate-sentence";
import { usePhaseEndsText } from "./use-phase-ends-text";
import { useRelearnSentence } from "./use-relearn-sentence";

/**
 * The sentence of a change the learner didn't make, said from its kind, with the notice topics it
 * moves into or out of the plan after what it did: "Lessons earlier days left come first, and the
 * rest of your plan moved forward. Genetics no longer fits by your date." Missed days and a
 * test-out moved topics without a word. A missed day says the phase end it moved (several are
 * listed under it, see `PhaseEndMoves`). A change a closer estimate of how long lessons take made
 * says why after what it did (see `useEstimateSentence`), then the phase end it moved: lessons that
 * slip past a challenge's day move it. Null for a kind said from its operations, and for an
 * estimate that changes neither the net lessons nor an end.
 */
export function useSystemChangeSentence({
  targetDate = null,
}: { targetDate?: string | null } = {}) {
  const t = useExtracted();
  const relearnSentence = useRelearnSentence();
  const coverageSentence = useCoverageSentence();
  const topicsMoved = useTopicsMovedSentence();
  const phaseEndsText = usePhaseEndsText();
  const estimateSentence = useEstimateSentence({ targetDate });

  const withTopics = (sentence: string, change: PlanChangeView, added = true): string =>
    [sentence, topicsMoved(change, { added })].filter(Boolean).join(" ");

  return function systemChangeSentence(change: PlanChangeView): string | null {
    switch (change.kind) {
      case "missedDays":
        return withTopics(
          [
            t("Lessons earlier days left come first, and the rest of your plan moved forward."),
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
