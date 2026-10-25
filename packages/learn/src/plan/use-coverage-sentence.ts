import { type PlanChangeView } from "@zoonk/core/plans/view-contract";
import { useExtracted } from "next-intl";
import { useShortList } from "./use-short-list";

/**
 * "Origin and evolution no longer fits by your date. Genetics now fits by your date." for the notice
 * topics a change leaves out of the plan or brings into it, so a change the learner didn't make (a
 * test-out, missed days, a goal back from a pause) names them. `added: false` leaves out the ones
 * it brings in, for a change whose own sentence names them; `named` caps the names said (see
 * `useShortList`). Null when it moves none.
 */
export function useTopicsMovedSentence() {
  const t = useExtracted();
  const shortList = useShortList();

  return function topicsMovedSentence(
    change: Pick<PlanChangeView, "effect">,
    { added = true, named }: { added?: boolean; named?: number } = {},
  ): string | null {
    const out = (change.effect?.topicsLeftOut ?? []).flatMap((area) => area.topics);
    const back = added ? (change.effect?.topicsAdded ?? []).flatMap((area) => area.topics) : [];

    const sentences = [
      out.length > 0 &&
        t(
          "{count, plural, one {{topics} no longer fits by your date.} other {{topics} no longer fit by your date.}}",
          { count: out.length, topics: shortList(out, "topics", { named }) },
        ),
      back.length > 0 &&
        t(
          "{count, plural, one {{topics} now fits by your date.} other {{topics} now fit by your date.}}",
          { count: back.length, topics: shortList(back, "topics", { named }) },
        ),
    ].filter((sentence) => typeof sentence === "string");

    return sentences.length > 0 ? sentences.join(" ") : null;
  };
}

/**
 * "Now in your plan: Genetics." and "Out of your plan: Origin and evolution.", one line each, for
 * the notice topics a change brings into the plan or leaves out of it: what a change moves, under
 * what it did. Empty when it moves no topic.
 */
function useTopicsMovedLines() {
  const t = useExtracted();
  const shortList = useShortList();

  return function topicsMovedLines(change: Pick<PlanChangeView, "effect">): string[] {
    const back = (change.effect?.topicsAdded ?? []).flatMap((area) => area.topics);
    const out = (change.effect?.topicsLeftOut ?? []).flatMap((area) => area.topics);

    return [
      back.length > 0 && t("Now in your plan: {topics}.", { topics: shortList(back, "topics") }),
      out.length > 0 && t("Out of your plan: {topics}.", { topics: shortList(out, "topics") }),
    ].filter((line) => typeof line === "string");
  };
}

/**
 * "Your placement answers changed what fits by your date. Now in your plan: Genetics. Out of your
 * plan: Origin and evolution." for a plan placement's answers planned again (`effect.fromPlacement`), so the
 * learner knows it was what they missed or showed they know. Null when it moves no topic.
 */
function usePlacementCoverageSentence() {
  const t = useExtracted();
  const topicsMovedLines = useTopicsMovedLines();

  return function placementCoverageSentence(change: Pick<PlanChangeView, "effect">): string | null {
    const lines = topicsMovedLines(change);

    return lines.length > 0
      ? [t("Your placement answers changed what fits by your date."), ...lines].join(" ")
      : null;
  };
}

/**
 * "Origin and evolution no longer fits by your date." for a plan planned again as lessons were
 * written, the learner studied or placement ended, which teaches other topics by its date
 * (`coverageChanged`): plans never change unannounced.
 */
export function useCoverageSentence() {
  const t = useExtracted();
  const topicsMoved = useTopicsMovedSentence();
  const placementSentence = usePlacementCoverageSentence();

  return (change: Pick<PlanChangeView, "effect">): string =>
    (change.effect?.fromPlacement ? placementSentence(change) : topicsMoved(change)) ??
    t("Your plan changed.");
}
