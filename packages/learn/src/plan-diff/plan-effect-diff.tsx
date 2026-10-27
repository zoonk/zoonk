"use client";

import { type PlanChangeView } from "@zoonk/core/plans/view-contract";
import { useExtracted, useFormatter } from "next-intl";
import { type DiffLine, DiffLines } from "../_components/diff-lines";
import { useFormatIsoDate } from "../_utils/iso-date";
import { getShownEndMove } from "./end-move";
import { getLessonLineTone } from "./line-tone";

type PlanEffect = NonNullable<PlanChangeView["effect"]>;

/** The goal's date before a change (null without one) and after it. */
type GoalDateMove = { after: string; before: string | null };

const NO_BREAK_SPACE = "\u00A0";

/** A Sunday, so a weekday number (Sunday 0 to Saturday 6) is that many days after it. */
const FIRST_SUNDAY = Date.parse("2023-01-01T00:00:00Z");
const DAY_MS = 86_400_000;

/** "Sunday", for a plan's weekday number. */
function useWeekdayName() {
  const format = useFormatter();

  return (weekday: number) =>
    format.dateTime(new Date(FIRST_SUNDAY + weekday * DAY_MS), {
      timeZone: "UTC",
      weekday: "long",
    });
}

/**
 * A day as a diff line says it, kept whole: a long line wraps before "October 12", never inside it
 * (phones read "until Oct" over "12").
 */
function useDiffDate() {
  const formatDate = useFormatIsoDate();

  return (...args: Parameters<typeof formatDate>): string =>
    formatDate(...args).replaceAll(" ", NO_BREAK_SPACE);
}

/**
 * A line that moves: what it was, then what it becomes; nothing when it doesn't move. A move is
 * neither good nor bad news on its own, so it carries no color.
 */
function moved({ after, before }: { after: string; before: string }): DiffLine[] {
  return after === before
    ? []
    : [
        { kind: "removed", text: before, tone: "neutral" },
        { kind: "added", text: after, tone: "neutral" },
      ];
}

/** A sentence as a diff line, whose lines end without a full stop ("Plan ends October 12"). */
function asLine(sentence: string): string {
  return sentence.replace(/\.$/u, "");
}

/**
 * The lessons a change leaves out and adds, each a line in the words its sentence says them
 * ("Leaves out 228 lessons", "Adds about 8 lessons" when some aren't written yet), so screen
 * readers hear no "Now" before them. Without a date they count against (`byDate`), the plan keeps
 * every lesson, so it only has fewer or more of them ("3 fewer lessons", "About 4 more lessons"):
 * "left out" is for lessons a date leaves no time for.
 */
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
    // Without a date only the net count changes: one line with the number its sentence says ("7
    // fewer lessons"), never "8 fewer" beside "1 more".
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

/** The goal's date a change moves: the one it had over the new one, or the new one alone. */
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

/**
 * What a plan change moves, line by line, the biggest change a learner can see first: the lessons
 * it leaves out or adds (what they'll study), then the goal's date when the card passes it, the
 * plan's end, each phase's and area's end, how many lessons an area has left, the next mock and
 * the week's mock or challenge day. Resting on
 * Saturdays highlighted the end moving a day while the 228 lessons it left out were only in its
 * sentence; an end that moves a day beside lessons that change isn't said (see `getShownEndMove`).
 */
function usePlanEffectLines() {
  const t = useExtracted();
  const formatDate = useDiffDate();
  const weekdayName = useWeekdayName();
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

/**
 * A plan change as a diff, colored by what it means for the learner (`getLessonLineTone`): the
 * lessons it leaves out or adds first, the one line in color (good news blue, bad news red), then
 * each date or count that moves, plain: the old value struck through over the new one. Nothing when
 * the change moves none; its sentence says the rest.
 */
export function PlanEffectDiff({
  byDate = true,
  className,
  effect,
  goalDate,
}: {
  /**
   * Whether the lessons it leaves out or adds count against a date still ahead (`countsByDate`).
   * Without one, an automatic change only gives the goal fewer or more lessons.
   */
  byDate?: boolean;
  className?: string;
  effect: PlanEffect | null;
  /** The goal's date a change moves, when the card knows both: it comes right after the lessons. */
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
