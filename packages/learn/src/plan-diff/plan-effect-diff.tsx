"use client";

import { type PlanChangeView } from "@zoonk/core/plans/view-contract";
import { useExtracted } from "next-intl";
import { type DiffLine, DiffLines } from "../_components/diff-lines";
import { useFormatIsoDate } from "../_utils/iso-date";
import { useFormatWeekday } from "../_utils/use-format-weekday";
import { getShownEndMove } from "./end-move";
import { getLessonLineTone } from "./line-tone";

type PlanEffect = NonNullable<PlanChangeView["effect"]>;

type GoalDateMove = { after: string; before: string | null };

const NO_BREAK_SPACE = "\u00A0";

function useDiffDate() {
  const formatDate = useFormatIsoDate();

  return (...args: Parameters<typeof formatDate>): string =>
    formatDate(...args).replaceAll(" ", NO_BREAK_SPACE);
}

function moved({ after, before }: { after: string; before: string }): DiffLine[] {
  return after === before
    ? []
    : [
        { kind: "removed", text: before, tone: "neutral" },
        { kind: "added", text: after, tone: "neutral" },
      ];
}

function asLine(sentence: string): string {
  return sentence.replace(/\.$/u, "");
}

function useLessonLines() {
  const t = useExtracted();

  const addedText = (effect: PlanEffect, byDate: boolean): string => {
    const lessons = effect.lessonsAdded;

    if (!byDate) {
      return effect.lessonsAddedEstimated
        ? t("About {lessons, plural, one {# more lesson} other {# more lessons}}.", { lessons })
        : t("{lessons, plural, one {# more lesson} other {# more lessons}}.", { lessons });
    }

    return effect.lessonsAddedEstimated
      ? t("Adds about {lessons, plural, one {# lesson} other {# lessons}}.", { lessons })
      : t("Adds {lessons, plural, one {# lesson} other {# lessons}}.", { lessons });
  };

  const removedText = (effect: PlanEffect, byDate: boolean): string => {
    const lessons = effect.lessonsRemoved;

    return byDate
      ? t("Leaves out {lessons, plural, one {# lesson} other {# lessons}}.", { lessons })
      : t("{lessons, plural, one {# fewer lesson} other {# fewer lessons}}.", { lessons });
  };

  return (effect: PlanEffect, byDate: boolean): DiffLine[] => {
    // Without a date only the net count changes, never "8 fewer" beside "1 more".
    const net = effect.lessonsAdded - effect.lessonsRemoved;

    const counts = byDate
      ? effect
      : { ...effect, lessonsAdded: Math.max(net, 0), lessonsRemoved: Math.max(-net, 0) };

    const added = addedText(counts, byDate);
    const removed = removedText(counts, byDate);

    return [
      counts.lessonsRemoved > 0 && {
        kind: "removed" as const,
        label: null,
        text: asLine(removed),
        tone: getLessonLineTone({ byDate, kind: "removed" }),
      },
      counts.lessonsAdded > 0 && {
        kind: "added" as const,
        label: null,
        text: asLine(added),
        tone: getLessonLineTone({ byDate, kind: "added" }),
      },
    ].filter((line) => line !== false);
  };
}

function useGoalDateLines() {
  const t = useExtracted();
  const formatDate = useDiffDate();
  const line = (isoDate: string) => t("Goal date {date}", { date: formatDate(isoDate, "long") });

  return ({ after, before }: GoalDateMove): DiffLine[] => {
    if (after === before) {
      return [];
    }

    const added: DiffLine = { kind: "added", text: line(after), tone: "neutral" };
    return before ? [{ kind: "removed", text: line(before), tone: "neutral" }, added] : [added];
  };
}

function usePlanEffectLines() {
  const t = useExtracted();
  const formatDate = useDiffDate();
  const weekdayName = useFormatWeekday();
  const lessonLines = useLessonLines();
  const goalDateLines = useGoalDateLines();

  return (effect: PlanEffect | null, goalDate?: GoalDateMove, byDate = true): DiffLine[] => {
    if (!effect) {
      return [];
    }

    const lessons = lessonLines(effect, byDate);

    const date = goalDate ? goalDateLines(goalDate) : [];

    const endMove = getShownEndMove(effect);

    const end = endMove
      ? moved({
          after: t("Plan ends {date}", { date: formatDate(endMove.after, "long") }),
          before: t("Plan ends {date}", { date: formatDate(endMove.before, "long") }),
        })
      : [];

    const phases = (effect.phaseEnds ?? []).flatMap((phase) =>
      moved({
        after: t("{name} until {date}", { date: formatDate(phase.after), name: phase.name }),
        before: t("{name} until {date}", { date: formatDate(phase.before), name: phase.name }),
      }),
    );

    const areas = (effect.areaEnds ?? []).flatMap((area) =>
      moved({
        after: t("{name} until {date}", { date: formatDate(area.after), name: area.area }),
        before: t("{name} until {date}", { date: formatDate(area.before), name: area.area }),
      }),
    );

    const areaLessons = (effect.areaLessons ?? []).flatMap((area) =>
      moved({
        after: t("{name}: {count, plural, one {# lesson} other {# lessons}} to go", {
          count: area.after,
          name: area.area,
        }),
        before: t("{name}: {count, plural, one {# lesson} other {# lessons}} to go", {
          count: area.before,
          name: area.area,
        }),
      }),
    );

    const mock = effect.nextMock
      ? moved({
          after: t("Next mock {date}", { date: formatDate(effect.nextMock.after) }),
          before: t("Next mock {date}", { date: formatDate(effect.nextMock.before) }),
        })
      : [];

    const weekly = effect.weeklyEvents;

    const week = weekly
      ? moved(
          weekly.kind === "mock"
            ? {
                after: t("Mock exams on {weekday}", { weekday: weekdayName(weekly.after) }),
                before: t("Mock exams on {weekday}", { weekday: weekdayName(weekly.before) }),
              }
            : {
                after: t("Weekly challenges on {weekday}", { weekday: weekdayName(weekly.after) }),
                before: t("Weekly challenges on {weekday}", {
                  weekday: weekdayName(weekly.before),
                }),
              },
        )
      : [];

    return [...lessons, ...date, ...end, ...phases, ...areas, ...areaLessons, ...mock, ...week];
  };
}

export function PlanEffectDiff({
  byDate = true,
  className,
  effect,
  goalDate,
}: {
  byDate?: boolean;
  className?: string;
  effect: PlanEffect | null;
  goalDate?: GoalDateMove;
}) {
  const t = useExtracted();
  const lines = usePlanEffectLines()(effect, goalDate, byDate);

  if (lines.length === 0) {
    return null;
  }

  return (
    <DiffLines
      className={className}
      labels={{ added: t("After the change"), removed: t("Now") }}
      lines={lines}
    />
  );
}
