"use client";

import { useExtracted, useFormatter } from "next-intl";
import { useFormatIsoDate } from "../_utils/iso-date";
import { toLabelCase } from "../_utils/label-case";
import { useFormatWeekday } from "../_utils/use-format-weekday";
import {
  type ChangeOptions,
  type GoalDateMove,
  type PlanEffect,
  countLessons,
  getTopicNames,
  useNames,
} from "./change-names";
import { getShownEndMove } from "./end-move";

export type ChangeRow = {
  after: string;
  before?: string;
  detail?: string;
  key: string;
  label: string;
};

const NAMED_IN_ROW = 8;

type Named = { count: number; names: string };

function useLessonRows() {
  const t = useExtracted();
  const listNames = useNames();

  const row = ({ count, key, label, names }: Named & { key: string; label: string }): ChangeRow => {
    const lessons = t("{count, plural, one {# lesson} other {# lessons}}", { count });

    return count > 0
      ? { after: lessons, detail: names || undefined, key, label }
      : { after: names, key, label };
  };

  const left = (effect: PlanEffect, removed: number): Named => {
    const topics = getTopicNames(effect.topicsLeftOut);

    const lessons = [
      ...(effect.lessonsLeftOut ?? []),
      ...(effect.unwrittenLeftOut ?? []).map((topic) => topic.skill),
    ];

    return {
      count: removed,
      names:
        topics.length > 0
          ? listNames({ kind: "topics", limit: NAMED_IN_ROW, names: topics })
          : listNames({ kind: "lessons", limit: NAMED_IN_ROW, names: lessons }),
    };
  };

  const joined = (effect: PlanEffect, added: number): Named => ({
    count: added,
    names: listNames({
      kind: "topics",
      limit: NAMED_IN_ROW,
      names: [...getTopicNames(effect.topicsAdded), ...(effect.outcomesAdded ?? [])],
    }),
  });

  const net = ({ added, removed }: { added: number; removed: number }): ChangeRow[] => {
    if (added === removed) {
      return [];
    }

    return [
      {
        after:
          removed > 0
            ? t("{count, plural, one {# fewer} other {# fewer}}", { count: removed })
            : t("{count, plural, one {# more} other {# more}}", { count: added }),
        key: "lessons",
        label: t("Lessons"),
      },
    ];
  };

  return (effect: PlanEffect, byDate: boolean): ChangeRow[] => {
    const counts = countLessons(effect, byDate);

    if (!byDate) {
      return net(counts);
    }

    const out = left(effect, counts.removed);
    const added = joined(effect, counts.added);

    return [
      ...(out.count > 0 || out.names
        ? [row({ ...out, key: "notInPlan", label: t("Not in your plan") })]
        : []),
      ...(added.count > 0 || added.names
        ? [row({ ...added, key: "added", label: t("Added to your plan") })]
        : []),
    ];
  };
}

function moved({ after, before, key, label }: Omit<ChangeRow, "detail">): ChangeRow[] {
  return after === before ? [] : [{ after, before, key, label }];
}

function useDateRows() {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();

  return (effect: PlanEffect, goalDate?: GoalDateMove): ChangeRow[] => {
    const end = getShownEndMove(effect);

    return [
      ...(goalDate
        ? moved({
            after: formatDate(goalDate.after),
            before: goalDate.before ? formatDate(goalDate.before) : undefined,
            key: "goalDate",
            label: t("End date"),
          })
        : []),
      ...(end
        ? moved({
            after: formatDate(end.after),
            before: formatDate(end.before),
            key: "end",
            label: t("Plan ends"),
          })
        : []),
      ...(effect.phaseEnds ?? []).flatMap((phase) =>
        moved({
          after: formatDate(phase.after),
          before: formatDate(phase.before),
          key: `phase:${phase.name}`,
          label: t("{name} ends", { name: phase.name }),
        }),
      ),
      ...(effect.areaStarts ?? []).flatMap((area) =>
        area.after
          ? moved({
              after: formatDate(area.after),
              before: area.before ? formatDate(area.before) : undefined,
              key: `start:${area.area}`,
              label: t("{name} starts", { name: area.area }),
            })
          : [],
      ),
      ...(effect.areaEnds ?? []).flatMap((area) =>
        moved({
          after: formatDate(area.after),
          before: formatDate(area.before),
          key: `end:${area.area}`,
          label: t("{name} ends", { name: area.area }),
        }),
      ),
    ];
  };
}

function useEventRows() {
  const t = useExtracted();
  const format = useFormatter();
  const formatDate = useFormatIsoDate();
  const weekdayName = useFormatWeekday();

  return (effect: PlanEffect): ChangeRow[] => {
    const weekly = effect.weeklyEvents;

    const { addedTopicsStart, nextMock, reviewFirst } = effect;

    return [
      ...(effect.areaLessons ?? []).map((area) => ({
        after: t(
          "{count, plural, =0 {# lessons to go} one {# lesson to go} other {# lessons to go}}",
          { count: area.after },
        ),
        before: String(area.before),
        key: `lessons:${area.area}`,
        label: area.area,
      })),
      ...(nextMock
        ? [
            {
              after: formatDate(nextMock.after),
              before: formatDate(nextMock.before),
              key: "nextMock",
              label: t("Next mock exam"),
            },
          ]
        : []),
      ...(weekly
        ? [
            {
              after: toLabelCase(weekdayName(weekly.after)),
              before: toLabelCase(weekdayName(weekly.before)),
              key: "weekly",
              label: weekly.kind === "mock" ? t("Mock exams") : t("Weekly challenge"),
            },
          ]
        : []),
      ...(reviewFirst
        ? [
            {
              after: t("Starts with {subjects}", {
                subjects: format.list(reviewFirst.areas, { type: "conjunction" }),
              }),
              key: "reviewFirst",
              label: t("Review on {date}", { date: formatDate(reviewFirst.date) }),
            },
          ]
        : []),
      ...(addedTopicsStart
        ? [{ after: formatDate(addedTopicsStart), key: "addedStart", label: t("New lessons start") }]
        : []),
    ];
  };
}

/** Everything a change does, as plain rows: what "See all changes" opens. */
export function usePlanChangeRows() {
  const lessonRows = useLessonRows();
  const dateRows = useDateRows();
  const eventRows = useEventRows();

  return (effect: PlanEffect | null, { byDate = true, goalDate }: ChangeOptions = {}): ChangeRow[] =>
    effect
      ? [...lessonRows(effect, byDate), ...dateRows(effect, goalDate), ...eventRows(effect)]
      : [];
}

