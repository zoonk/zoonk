"use client";

import { type PlanChangePreview } from "@zoonk/core/plans/preview-contract";
import { useExtracted } from "next-intl";
import { useFormatShare } from "../_utils/percent";
import { usePlanScreen } from "./plan-context";
import { useShortList } from "./use-short-list";

type Preview = PlanChangePreview & { ready: true };
type AreaTopics = { area: string; topics: string[] }[];

/** "Ecology, Heat and 2 more": the topics a change moves, by name. */
function useTopicNames() {
  const shortList = useShortList();

  return (areas: AreaTopics | undefined): { count: number; names: string } => {
    const topics = (areas ?? []).flatMap((area) => area.topics);
    return { count: topics.length, names: shortList(topics, "topics") };
  };
}

/** What the time covers by the date with the choices, next to what it covers now. */
function useCoverageLine() {
  const t = useExtracted();
  const formatShare = useFormatShare();
  const { plan } = usePlanScreen();

  return (feasibility: NonNullable<Preview["feasibility"]>): string => {
    if (feasibility.fits) {
      return t("Everything then fits by your date.");
    }

    const values = {
      after: formatShare(feasibility.coveredShare),
      before: formatShare(plan.feasibility?.coveredShare ?? 0),
    };

    if (values.after === values.before) {
      return feasibility.measure === "exam"
        ? t("By your date: {after} of the exam, as now.", values)
        : t("By your date: {after} of your goal, as now.", values);
    }

    return feasibility.measure === "exam"
      ? t("By your date: {after} of the exam, against {before} now.", values)
      : t("By your date: {after} of your goal, against {before} now.", values);
  };
}

/**
 * What the learner's choices would do beyond their diff (`PlanEffectDiff`, which counts the lessons
 * they add and leave out, then the plan's end and every date that moves): the topics that come into
 * the plan and the ones that leave it, by name, and what their time then covers by the date against
 * now. Without the topics, a core for a base said only that lessons come in, not that heat does.
 */
export function useBasesFootnote() {
  const t = useExtracted();
  const topicNames = useTopicNames();
  const coverageLine = useCoverageLine();

  return (preview: Preview): string[] => {
    const added = topicNames(preview.effect?.topicsAdded);
    const leftOut = topicNames(preview.effect?.topicsLeftOut);

    return [
      added.count > 0 &&
        t(
          "{count, plural, one {# topic comes in: {topics}.} other {# topics come in: {topics}.}}",
          { count: added.count, topics: added.names },
        ),
      leftOut.count > 0 &&
        t("{count, plural, one {# topic leaves: {topics}.} other {# topics leave: {topics}.}}", {
          count: leftOut.count,
          topics: leftOut.names,
        }),
      preview.feasibility && coverageLine(preview.feasibility),
    ].filter((line) => typeof line === "string");
  };
}
