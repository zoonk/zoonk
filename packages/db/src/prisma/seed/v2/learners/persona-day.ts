import { isJsonObject } from "@zoonk/utils/json";
import { daysFrom } from "../_utils/dates";
import { getPlannedEnemEdition } from "../library/enem/enem-edition";
import { itemLessonKeys, listCourseLessons } from "./plan-graph";
import { type SeedPersonaName, buildPersona } from "./seed-personas";
import {
  type SeedLanguageHistory,
  type SeedLearner,
  type SeedPlanChange,
  type SeedPlanItem,
} from "./types";

/*
 * A persona is written on one day of its plan: day 1 is the day the plan was made. These move it
 * to another day as plain data, before anything is written, so the seed's writers stay the only
 * path to the database.
 */

/** The day of its plan the persona is on: day 1 is the day its plan was made. */
function getPlanDay(learner: SeedLearner): number {
  return 1 - learner.goal.createdDay;
}

/**
 * Placement runs while the plan is made, before day 1's study: the answers given outside a session
 * and the lessons it tested out of. Those stay on the plan's first day when it moves.
 */
function isPlacement(
  learner: SeedLearner,
  { day, placement }: { day: number; placement: boolean },
): boolean {
  return placement && day === learner.goal.createdDay;
}

function isFinished(item: SeedPlanItem): boolean {
  return item.status !== "todo";
}

function isStudied(item: SeedPlanItem): boolean {
  return item.status === "done" || item.status === "testedOut";
}

/** Whether a change set the areas to focus on, which plan settings then keep. */
function setsFocusAreas(change: SeedPlanChange): boolean {
  const { operations } = change.payload;

  return (
    Array.isArray(operations) &&
    operations.some((operation) => isJsonObject(operation) && operation.kind === "focusAreas")
  );
}

/** Events dated by the learner's days that had happened by the new today, counted from it. */
function rewindEvents<Event extends { day: number }>(
  { happened, shift }: Rewind,
  events: readonly Event[] = [],
): Event[] {
  return events
    .filter((event) => happened(event.day))
    .map((event) => ({ ...event, day: shift(event.day) }));
}

/** How far through its history the persona is, to scale totals that only grow with it. */
function scaleBy(total: number, ratio: number): number {
  return Math.round(total * ratio);
}

/**
 * The persona with a plan made `days` days earlier: the persona's usual generated history fills
 * the extra days, and placement moves to the new first day with the plan.
 */
function startPersonaEarlier(learner: SeedLearner, days: number): SeedLearner {
  const { goal, history } = learner;
  const firstDay = goal.createdDay - days;

  const moved = (day: number, placement: boolean) =>
    isPlacement(learner, { day, placement }) ? firstDay : day;

  return {
    ...learner,
    attempts: learner.attempts.map((attempt) => ({
      ...attempt,
      day: moved(attempt.day, !attempt.inSession),
    })),
    brainPower:
      history.days > 0
        ? scaleBy(learner.brainPower, (history.days + days) / history.days)
        : learner.brainPower,
    goal: {
      ...goal,
      createdDay: firstDay,
      plan: {
        ...goal.plan,
        changes: goal.plan.changes?.map((change) => ({
          ...change,
          day: moved(change.day, change.kind === "testedOut"),
        })),
        items: goal.plan.items.map((item) =>
          item.day === undefined
            ? item
            : { ...item, day: moved(item.day, item.status === "testedOut") },
        ),
      },
    },
    history: { ...history, days: history.days + days },
  };
}

type Rewind = {
  learner: SeedLearner;
  /** Whether something dated `day` in the persona's own days had happened by the new today. */
  happened: (day: number, placement?: boolean) => boolean;
  /** A day in the persona's own days, counted from the new today. */
  shift: (day: number) => number;
};

function rewindItem({ happened, shift }: Rewind, item: SeedPlanItem): SeedPlanItem {
  if (item.day === undefined) {
    return item;
  }

  const isUndone = isFinished(item) && !happened(item.day, item.status === "testedOut");

  return { ...item, day: shift(item.day), status: isUndone ? "todo" : item.status };
}

function rewindAttempts(rewind: Rewind) {
  const { happened, learner, shift } = rewind;

  return learner.attempts
    .filter((attempt) => happened(attempt.day, !attempt.inSession))
    .map((attempt) => {
      const { mistake } = attempt;
      const day = shift(attempt.day);

      if (mistake?.status !== "fixed") {
        return { ...attempt, day };
      }

      // A mistake fixed after the new today is still open, and one without a day was fixed yesterday.
      const fixedDay = mistake.fixedDay ?? -1;

      return {
        ...attempt,
        day,
        mistake: happened(fixedDay)
          ? { ...mistake, fixedDay: shift(fixedDay) }
          : { ...mistake, fixedDay: undefined, status: "open" as const },
      };
    });
}

/** The skills each answer and finished plan item gives evidence of. */
function listEvidencedSkills(
  learner: SeedLearner,
  { attempts, items }: Pick<SeedLearner, "attempts"> & { items: readonly SeedPlanItem[] },
): Set<string> {
  const { course } = learner.goal;

  const studied = new Set(
    items.filter((item) => isStudied(item)).flatMap((item) => itemLessonKeys(course, item)),
  );

  const taught = listCourseLessons(course)
    .filter((lesson) => studied.has(lesson.key))
    .flatMap((lesson) => lesson.skills);

  return new Set([...attempts.map((attempt) => attempt.skill), ...taught]);
}

/**
 * Skills with evidence only after the new today weren't studied yet. Skills nothing dates are
 * the ones placement or the learner's own words settled, so they stay.
 */
function rewindSkills(
  learner: SeedLearner,
  rewound: Pick<SeedLearner, "attempts"> & { items: readonly SeedPlanItem[] },
) {
  const evidenced = listEvidencedSkills(learner, rewound);

  const everEvidenced = listEvidencedSkills(learner, {
    attempts: learner.attempts,
    items: learner.goal.plan.items,
  });

  return learner.skills.filter(({ skill }) => evidenced.has(skill) || !everEvidenced.has(skill));
}

function rewindLanguageHistory(
  rewind: Rewind,
  { history, ratio }: { history: SeedLanguageHistory; ratio: number },
): SeedLanguageHistory {
  return {
    ...history,
    conversations: rewindEvents(rewind, history.conversations),
    // Levels move from the level test's result toward today's as the history does.
    levels: history.levels.map((level) => ({
      ...level,
      score: level.start + (level.score - level.start) * ratio,
    })),
    pattern: rewindEvents(rewind, history.pattern ? [history.pattern] : [])[0] ?? null,
    words: rewindEvents(rewind, history.words),
  };
}

/**
 * The persona `days` days back, as it was when that day began: built `days` days later than the
 * day it's written on, so its weekdays and exam dates stay real, then cut at the new today. What
 * it did before the new today stays; what came later didn't happen yet: those plan items are to
 * do again, mistakes fixed later are open, and today's session isn't built (the app builds it when
 * the learner opens Today). Memory the app noticed in activity goes, since the seed doesn't date it.
 */
function rewindPersona(learner: SeedLearner, days: number): SeedLearner {
  const { goal, history } = learner;
  const today = -days;

  const rewind: Rewind = {
    happened: (day, placement = false) => day < today || isPlacement(learner, { day, placement }),
    learner,
    shift: (day) => day + days,
  };

  const { happened, shift } = rewind;
  const historyDays = Math.max(0, history.days - days);
  const ratio = history.days > 0 ? historyDays / history.days : 1;
  const attempts = rewindAttempts(rewind);
  const items = goal.plan.items.map((item) => rewindItem(rewind, item));

  const changes = goal.plan.changes
    ?.filter((change) => happened(change.day, change.kind === "testedOut"))
    .map((change) => ({ ...change, day: shift(change.day) }));

  const milestones = rewindEvents(rewind, learner.milestones).map((milestone) => ({
    ...milestone,
    bossDay: milestone.bossDay === undefined ? undefined : shift(milestone.bossDay),
  }));

  const keepsGlasses = milestones.some(
    (milestone) => milestone.kind === "glasses" && milestone.key === learner.buddy?.glasses,
  );

  return {
    ...learner,
    attempts,
    brainPower: scaleBy(learner.brainPower, ratio),
    buddy: learner.buddy && !keepsGlasses ? { ...learner.buddy, glasses: "round" } : learner.buddy,
    goal: {
      ...goal,
      createdDay: shift(goal.createdDay),
      plan: {
        ...goal.plan,
        changes,
        // The areas to focus on came from a change to the plan; before it, there are none.
        focusAreas: changes?.some((change) => setsFocusAreas(change))
          ? goal.plan.focusAreas
          : undefined,
        items,
      },
    },
    history: {
      ...history,
      checkpoints: rewindEvents(rewind, history.checkpoints),
      days: historyDays,
      mocks: rewindEvents(rewind, history.mocks),
    },
    languageHistory:
      learner.languageHistory &&
      rewindLanguageHistory(rewind, { history: learner.languageHistory, ratio }),
    memory: learner.memory.filter((fact) => fact.origin !== "noticed"),
    milestones,
    session: null,
    skills: rewindSkills(learner, { attempts, items }),
  };
}

/**
 * A persona on day `day` of its plan (its own day when absent), back after `awayDays` days without
 * studying: the persona as it was on its last study day, `day - awayDays`, moved that many days
 * into the past. Returns the learner and that last study day's moment, which it's written from.
 */
export function buildPersonaOn({
  awayDays = 0,
  day,
  name,
  now,
}: {
  awayDays?: number;
  day?: number;
  name: SeedPersonaName;
  now: Date;
}): { learner: SeedLearner; now: Date } {
  const lastActive = daysFrom(now, -awayDays);

  const build = (moment: Date) =>
    buildPersona({ edition: getPlannedEnemEdition(moment), name, now: moment });

  const own = build(lastActive);
  const ownDay = getPlanDay(own);
  const lastDay = day === undefined ? ownDay : day - awayDays;

  if (lastDay < 1) {
    throw new Error(
      `Day ${day} after ${awayDays} days away puts the last study before the plan began: pick day ${awayDays + 1} or later.`,
    );
  }

  if (lastDay < ownDay) {
    const days = ownDay - lastDay;
    return { learner: rewindPersona(build(daysFrom(lastActive, days)), days), now: lastActive };
  }

  return {
    learner: lastDay > ownDay ? startPersonaEarlier(own, lastDay - ownDay) : own,
    now: lastActive,
  };
}
