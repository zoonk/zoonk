"use client";

import { type PlanChangePreview } from "@zoonk/core/plans/preview-contract";
import { useExtracted } from "next-intl";
import { useFormatShare } from "../_utils/percent";
import { usePlanScreen } from "./plan-context";
import { useShortList } from "./use-short-list";

type Preview = PlanChangePreview & { ready: true };
type AreaTopics = { area: string; topics: string[] }[];

function useTopicNames() {
  const shortList = useShortList();

  return (areas: AreaTopics | undefined): { count: number; names: string } => {
    const topics = (areas ?? []).flatMap((area) => area.topics);
    return { count: topics.length, names: shortList(topics, "topics") };
  };
}

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
