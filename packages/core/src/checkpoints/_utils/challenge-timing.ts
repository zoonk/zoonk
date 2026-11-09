import { type Goal, type StudySessionBlock } from "@zoonk/db";
import { hasOverduePlanWork } from "../../plans/_utils/left-work";
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
import { dropSettledEvents } from "../../sessions/_utils/settled-events";
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
    {
      length:
        daysBetween(today, new Date(last)) +
        DAYS_PER_WEEK *
          Math.max(
            1,
            items.filter((item) => item.kind === "boss" && item.status === "todo").length,
          ) +
        1,
    },
    (_, index) => addDays(today, index),
  );

  const todayItems = hasOverduePlanWork({ items, today })
    ? dropSettledEvents({ items, settings, today })
    : items;

  const capacity = (date: Date) => {
    const isToday = date.getTime() === today.getTime();

    const reviewDay = isToday
      ? findPlannedReview({ items: todayItems, today }) !== null
      : items.some(
          (item) => item.kind === "review" && item.scheduledFor?.getTime() === date.getTime(),
        );

    return canHoldPhaseChallenges({
      mockOnlyDay: isMockOnlyDay({
        goal,
        hasMock: true,
        items: isToday ? todayItems : items,
        planSettings: settings,
        today: date,
      }),
      reviewDay,
      trialEnded: false,
    })
      ? getGoalDayMinutes({ date, goal, planSettings: settings })
      : 0;
  };

  const nextStudy = days.find(
    (date) =>
      (!savedDay || date > today) && getGoalDayMinutes({ date, goal, planSettings: settings }) > 0,
  );

  const inToday = (boss: TimingItem) =>
    boss.status === "todo" &&
    todayBlocks.some(
      (block) =>
        (block.status === "pending" || block.status === "active") &&
        readBlockPayload(block).planItemId === (boss.id ?? boss.key ?? ""),
    );

  const reached = items
    .toSorted((a, b) => a.position - b.position)
    .flatMap((boss): ReachedChallenge[] => {
      const id = boss.id ?? boss.key ?? "";
      const facts = readSelectedItemFacts(boss.facts)?.boss;
      const result = results.get(id);

      if (
        !isChallengeReached({ boss, items }) ||
        inToday(boss) ||
        !facts ||
        facts.waiting ||
        facts.testedSkillIds.length === 0
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

  const lostToday = new Set(
    [...results].flatMap(([id, result]) =>
      result.localDate.getTime() === today.getTime() ? [id] : [],
    ),
  );

  const next = days.find((date) => (!savedDay || date > today) && capacity(date) > 0);
  const dates = new Map<string, Date>();

  for (const date of days) {
    const budget = capacity(date);

    if ((!savedDay || date > today) && budget > 0) {
      const ids = listDayChallengeIds({
        budget,
        date,
        items,
        lastSessionChallenges: date === next ? lastSessionChallenges : undefined,
        reached: reached.filter(
          (entry) => !dates.has(entry.id) && (date > today || !lostToday.has(entry.id)),
        ),
      });

      for (const id of ids) {
        dates.set(id, date);
      }
    }

    if (dates.size === reached.length) {
      break;
    }
  }

  const tomorrow = addDays(today, 1);
  const future = days.find((date) => date >= tomorrow && capacity(date) > 0);

  return new Map(
    items
      .filter((boss) => boss.kind === "boss")
      .map((boss) => {
        const id = boss.id ?? boss.key ?? "";
        const offeredToday = inToday(boss);

        const assigned = dates.get(id);
        const nextSession = !savedDay && assigned && assigned.getTime() === nextStudy?.getTime();

        const estimatedFor =
          assigned ?? (isChallengeReached({ boss, items }) ? future : boss.scheduledFor);

        const estimate = new Date(Math.max(tomorrow.getTime(), estimatedFor?.getTime() ?? 0));

        return [
          id,
          {
            date: offeredToday ? toIsoDate(today) : toIsoDate(estimate),
            when: offeredToday || nextSession ? "nextSession" : "date",
          },
        ];
      }),
  );
}
