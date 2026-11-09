import { type Goal, type StudySessionBlock } from "@zoonk/db";
import { readSelectedItemFacts } from "../../plans/_utils/selected-item-contract";
import { addDays, daysBetween, toIsoDate } from "../../plans/planner/plan-calendar";
import { LEARN_KINDS } from "../../plans/planner/plan-item-rules";
import { DAYS_PER_WEEK, type PlanSettings } from "../../plans/planner/plan-state";
import { isAllocatedOn } from "../../sessions/_utils/day-lessons";
import { getGoalDayMinutes } from "../../sessions/_utils/day-minutes";
import { isMockOnlyDay } from "../../sessions/_utils/day-mock";
import { findPlannedReview } from "../../sessions/_utils/day-review";
import {
  fundLeadingChallenges,
  getLeadingChallenges,
  listDayStretch,
  placePutOffChallenges,
} from "../../sessions/_utils/day-stretch";
import { canHoldPhaseChallenges } from "../../sessions/_utils/phase-challenge-day";
import { readBlockPayload } from "../../sessions/block-payload";
import { type BossTiming, type ChallengeReachItem, isChallengeReached } from "./challenge-reach";
import { type CheckpointResult } from "./checkpoint-results";

type TimingItem = ChallengeReachItem & {
  facts?: unknown;
  minutes?: number | null;
  phase: number;
  scheduledFor: Date | null;
};
export type ChallengeTiming = { date: string | null; when: BossTiming };

type ReachedChallenge = {
  id: string;
  kind: "boss";
  minutes: number;
  mock: false;
  planItemId: string | null;
  planItemKey?: string;
  rematch: boolean;
};

function listDayChallengeIds({
  budget,
  date,
  items,
  lastSessionChallenges,
  reached,
}: {
  budget: number;
  date: Date;
  items: readonly TimingItem[];
  lastSessionChallenges?: ReadonlyMap<string, boolean>;
  reached: readonly ReachedChallenge[];
}): string[] {
  const lessons = items.flatMap((item) =>
    LEARN_KINDS.has(item.kind) && item.status === "todo" && isAllocatedOn({ item, today: date })
      ? [{ minutes: item.minutes ?? 0, planItemId: item.id, planItemKey: item.key }]
      : [],
  );

  const checkpoints = placePutOffChallenges({
    checkpoints: reached,
    hasLessons: lessons.length > 0,
    lastSession: lastSessionChallenges,
  });

  return listDayStretch({
    budget,
    checkpoints,
    items,
    leading: fundLeadingChallenges({
      budget,
      checkpoints: getLeadingChallenges({ checkpoints, items }),
    }),
    lessons,
    overflow: true,
  }).flatMap((entry) => (entry.kind === "challenge" ? [entry.checkpoint.id] : []));
}

export function getChallengeTimings({
  goal,
  items,
  settings,
  today,
  todayBlocks = [],
  savedDay = false,
  lastSessionChallenges,
  results = new Map(),
}: {
  goal: Pick<Goal, "dailyMinutes" | "kind" | "targetDate">;
  items: readonly TimingItem[];
  settings: PlanSettings;
  today: Date;
  todayBlocks?: readonly Pick<StudySessionBlock, "payload" | "status">[];
  savedDay?: boolean;
  /** Only for a day not built yet; a built day's blocks already decide it (`getSessionChallenges`). */
  lastSessionChallenges?: ReadonlyMap<string, boolean>;
  results?: ReadonlyMap<string, CheckpointResult>;
}): ReadonlyMap<string, ChallengeTiming> {
  const dated = items.flatMap((item) =>
    (item.kind === "mock" || item.kind === "review") && item.scheduledFor
      ? [item.scheduledFor]
      : [],
  );

  const last = Math.max(today.getTime(), ...dated.map((date) => date.getTime()));

  const days = Array.from(
    { length: daysBetween(today, new Date(last)) + DAYS_PER_WEEK + 1 },
    (_, index) => addDays(today, index),
  );

  const capacity = (date: Date) => {
    const blocked =
      (date.getTime() === today.getTime() && findPlannedReview({ items, today }) !== null) ||
      items.some(
        (item) => item.kind === "review" && item.scheduledFor?.getTime() === date.getTime(),
      );

    return canHoldPhaseChallenges({
      mockOnlyDay: isMockOnlyDay({
        goal,
        hasMock: true,
        items,
        planSettings: settings,
        today: date,
      }),
      reviewDay: blocked,
      trialEnded: false,
    })
      ? getGoalDayMinutes({ date, goal, planSettings: settings })
      : 0;
  };

  const nextStudy = days.find(
    (date) =>
      (!savedDay || date > today) && getGoalDayMinutes({ date, goal, planSettings: settings }) > 0,
  );

  const next = days.find((date) => (!savedDay || date > today) && capacity(date) > 0);

  const reached = items.flatMap((boss): ReachedChallenge[] => {
    const id = boss.id ?? boss.key ?? "";
    const facts = readSelectedItemFacts(boss.facts)?.boss;
    const result = results.get(id);

    if (
      !isChallengeReached({ boss, items }) ||
      !facts ||
      facts.waiting ||
      facts.testedSkillIds.length === 0 ||
      (result && result.localDate.getTime() === today.getTime())
    ) {
      return [];
    }

    return [
      {
        id,
        kind: "boss",
        minutes: facts.minutes,
        mock: false,
        planItemId: boss.id,
        planItemKey: boss.key,
        rematch: result !== undefined,
      },
    ];
  });

  const funded = new Set(
    next
      ? listDayChallengeIds({
          budget: capacity(next),
          date: next,
          items,
          lastSessionChallenges,
          reached,
        })
      : [],
  );

  const tomorrow = addDays(today, 1);
  const future = days.find((date) => date >= tomorrow && capacity(date) > 0);

  return new Map(
    items
      .filter((boss) => boss.kind === "boss")
      .map((boss) => {
        const id = boss.id ?? boss.key ?? "";

        const inToday =
          boss.status === "todo" &&
          todayBlocks.some(
            (block) =>
              (block.status === "pending" || block.status === "active") &&
              readBlockPayload(block).planItemId === id,
          );

        const nextSession =
          !savedDay && next && funded.has(id) && next.getTime() === nextStudy?.getTime();

        const estimate = isChallengeReached({ boss, items })
          ? (future ?? tomorrow)
          : new Date(Math.max(tomorrow.getTime(), boss.scheduledFor?.getTime() ?? 0));

        return [
          id,
          {
            date: inToday ? toIsoDate(today) : toIsoDate(estimate),
            when: inToday || nextSession ? "nextSession" : "date",
          },
        ];
      }),
  );
}
