"use client";

import { type PlanChangePreview } from "@zoonk/core/plans/preview-contract";
import { useExtracted } from "next-intl";
import { useFormatIsoDate } from "../_utils/iso-date";
import { useFormatShare } from "../_utils/percent";
import { usePlanScreen } from "./plan-context";
import { useLessonsEffectText } from "./use-effect-counts";
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
 * What the learner's choices would do, before they save them: the topics that come into the plan
 * and the ones that leave it, by name, the lessons it adds and leaves out as the card after saving
 * says them, what their time then covers by the date against now, and when their lessons end when
 * that moves. Without the lessons, a core for a base said only that heat comes in, and saving left
 * out 18 lessons of electricity, a topic the learner was in the middle of.
 */
export function useBasesEffectLines() {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();
  const topicNames = useTopicNames();
  const coverageLine = useCoverageLine();
  const lessonsText = useLessonsEffectText();

  return (preview: Preview): string[] => {
    const added = topicNames(preview.effect?.topicsAdded);
    const leftOut = topicNames(preview.effect?.topicsLeftOut);
    const before = preview.effect?.endDateBefore;
    const after = preview.effect?.endDateAfter;

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
      lessonsText(preview.effect),
      preview.feasibility && coverageLine(preview.feasibility),
      before &&
        after &&
        before !== after &&
        t("Your lessons end on {after} instead of {before}.", {
          after: formatDate(after, "long"),
          before: formatDate(before, "long"),
        }),
    ].filter((line) => typeof line === "string");
  };
}
