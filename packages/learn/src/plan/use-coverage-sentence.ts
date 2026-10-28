import { type PlanChangeView } from "@zoonk/core/plans/view-contract";
import { useExtracted } from "next-intl";
import { useShortList } from "./use-short-list";

/** `added: false` leaves out the topics it brings in, for a change whose own sentence names them; `named` caps the names said. */
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

export function useCoverageSentence() {
  const t = useExtracted();
  const topicsMoved = useTopicsMovedSentence();
  const placementSentence = usePlacementCoverageSentence();

  return (change: Pick<PlanChangeView, "effect">): string =>
    (change.effect?.fromPlacement ? placementSentence(change) : topicsMoved(change)) ??
    t("Your plan changed.");
}
