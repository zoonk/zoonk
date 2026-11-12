"use client";

import { useExtracted } from "next-intl";
import { useFormatIsoDate } from "../_utils/iso-date";
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

const NAMED_IN_SENTENCE = 3;

type Consequence = { key: string; text: string; whole: boolean };

function useLessonConsequence() {
  const t = useExtracted();
  const listNames = useNames();

  return function lessonConsequence(effect: PlanEffect, byDate: boolean): Consequence | null {
    const topicsOut = getTopicNames(effect.topicsLeftOut);
    const topicsIn = getTopicNames(effect.topicsAdded);
    const { added, removed } = countLessons(effect, byDate);

    if (topicsOut.length > 0) {
      return {
        key: "notInPlan",
        text: t(
          "{count, plural, one {{topics} won't be in your plan.} other {{topics} won't be in your plan.}}",
          {
            count: topicsOut.length,
            topics: listNames({ kind: "topics", limit: NAMED_IN_SENTENCE, names: topicsOut }),
          },
        ),
        whole: topicsOut.length <= NAMED_IN_SENTENCE && removed === 0,
      };
    }

    if (byDate && removed > 0) {
      return {
        key: "notInPlan",
        text: t(
          "{count, plural, one {# lesson won't be in your plan.} other {# lessons won't be in your plan.}}",
          { count: removed },
        ),
        whole: (effect.lessonsLeftOut ?? []).length + (effect.unwrittenLeftOut ?? []).length === 0,
      };
    }

    if (topicsIn.length > 0) {
      return {
        key: "added",
        text: t(
          "{count, plural, one {{topics} will be added to your plan.} other {{topics} will be added to your plan.}}",
          {
            count: topicsIn.length,
            topics: listNames({ kind: "topics", limit: NAMED_IN_SENTENCE, names: topicsIn }),
          },
        ),
        whole: topicsIn.length <= NAMED_IN_SENTENCE && added === 0,
      };
    }

    return byDate && added > 0
      ? {
          key: "added",
          text: t(
            "{count, plural, one {# more lesson will be in your plan.} other {# more lessons will be in your plan.}}",
            { count: added },
          ),
          whole: true,
        }
      : null;
  };
}

function useEndConsequence() {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();

  return function endConsequence(
    effect: PlanEffect,
    goalDate?: GoalDateMove,
  ): Consequence | null {
    const end = getShownEndMove(effect);

    // A change that moves the goal's own date already says the date in its title.
    return end && !goalDate
      ? {
          key: "end",
          text: t({
            description: '{after} and {before} are days, like "May 5".',
            message: "Your plan will end on {after} instead of {before}.",
            values: {
              after: formatDate(end.after, "long"),
              before: formatDate(end.before, "long"),
            },
          }),
          whole: true,
        }
      : null;
  };
}

function useEventConsequence() {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();
  const weekdayName = useFormatWeekday();

  return function eventConsequence(effect: PlanEffect): Consequence | null {
    const [phase, ...otherPhases] = effect.phaseEnds ?? [];
    const weekly = effect.weeklyEvents;

    if (phase && otherPhases.length === 0 && phase.after !== phase.before) {
      return {
        key: `phase:${phase.name}`,
        text: t({
          description: '{after} and {before} are days, like "May 5".',
          message: "{phase} will end on {after} instead of {before}.",
          values: {
            after: formatDate(phase.after, "long"),
            before: formatDate(phase.before, "long"),
            phase: phase.name,
          },
        }),
        whole: true,
      };
    }

    if (effect.nextMock) {
      return {
        key: "nextMock",
        text: t({
          description: '{date} is a weekday and day, like "Monday, May 5".',
          message: "Your next mock exam will be on {date}.",
          values: { date: formatDate(effect.nextMock.after, "weekdayDay") },
        }),
        whole: true,
      };
    }

    if (!weekly) {
      return null;
    }

    const day = weekdayName(weekly.after);

    return {
      key: "weekly",
      text:
        weekly.kind === "mock"
          ? t({
              description: '{day} is a weekday, like "Monday".',
              message: "Your mock exams will be on {day}.",
              values: { day },
            })
          : t({
              description: '{day} is a weekday, like "Monday".',
              message: "Your weekly challenge will be on {day}.",
              values: { day },
            }),
      whole: true,
    };
  };
}

/**
 * The one thing a learner would notice about a change: what leaves the plan, else when it ends,
 * else what joins it. `whole` is false when its row says more than the sentence.
 */
export function usePlanChangeConsequence() {
  const lessonConsequence = useLessonConsequence();
  const endConsequence = useEndConsequence();
  const eventConsequence = useEventConsequence();

  return function planChangeConsequence(
    effect: PlanEffect | null,
    { byDate = true, goalDate }: ChangeOptions = {},
  ): Consequence | null {
    if (!effect) {
      return null;
    }

    const lessons = lessonConsequence(effect, byDate);

    if (lessons?.key === "notInPlan") {
      return lessons;
    }

    return endConsequence(effect, goalDate) ?? lessons ?? eventConsequence(effect);
  };
}
