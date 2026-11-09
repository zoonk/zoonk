import { type Goal, type StudySessionBlock } from "@zoonk/db";
import { readSelectedItemFacts } from "../../plans/_utils/selected-item-contract";
import { addDays, daysBetween, toIsoDate } from "../../plans/planner/plan-calendar";
import { DAYS_PER_WEEK, type PlanSettings } from "../../plans/planner/plan-state";
import { getGoalDayMinutes } from "../../sessions/_utils/day-minutes";
import { isMockOnlyDay } from "../../sessions/_utils/day-mock";
import { fundLeadingChallenges } from "../../sessions/_utils/day-stretch";
import { canHoldPhaseChallenges } from "../../sessions/_utils/phase-challenge-day";
import { readBlockPayload } from "../../sessions/block-payload";
import { type BossTiming, type ChallengeReachItem, isChallengeReached } from "./challenge-reach";
import { type CheckpointResult } from "./checkpoint-results";

type TimingItem = ChallengeReachItem & {
  facts?: unknown;
  phase: number;
  scheduledFor: Date | null;
};
export type ChallengeTiming = { date: string | null; when: BossTiming };

/** Today is what Today shows; every later day is an estimate of the room it leaves challenges. */
export function getChallengeTimings({
  goal,
  items,
  results = new Map(),
  settings,
  today,
  todayBlocks,
  todaySessionDate = today,
}: {
  goal: Pick<Goal, "dailyMinutes" | "kind" | "targetDate">;
  items: readonly TimingItem[];
  results?: ReadonlyMap<string, CheckpointResult>;
  settings: PlanSettings;
  today: Date;
  /** Today's saved blocks once Start built the day, else the day Today plans (`previewTodayBlocks`). */
  todayBlocks: readonly Pick<StudySessionBlock, "payload" | "status">[];
  todaySessionDate?: Date;
}): ReadonlyMap<string, ChallengeTiming> {
  const tomorrow = addDays(todaySessionDate, 1);

  const last = Math.max(
    tomorrow.getTime(),
    ...items.flatMap((item) =>
      (item.kind === "mock" || item.kind === "review") && item.scheduledFor
        ? [item.scheduledFor.getTime()]
        : [],
    ),
  );

  const days = Array.from(
    {
      length:
        daysBetween(tomorrow, new Date(last)) +
        DAYS_PER_WEEK *
          Math.max(
            1,
            items.filter((item) => item.kind === "boss" && item.status === "todo").length,
          ) +
        1,
    },
    (_, index) => addDays(tomorrow, index),
  );

  const capacity = (date: Date) =>
    canHoldPhaseChallenges({
      mockOnlyDay: isMockOnlyDay({
        goal,
        hasMock: true,
        items,
        planSettings: settings,
        today: date,
      }),
      reviewDay: items.some(
        (item) => item.kind === "review" && item.scheduledFor?.getTime() === date.getTime(),
      ),
      trialEnded: false,
    })
      ? getGoalDayMinutes({ date, goal, planSettings: settings })
      : 0;

  const getId = (boss: TimingItem) => boss.id ?? boss.key ?? "";

  const inToday = (boss: TimingItem) =>
    boss.status === "todo" &&
    todayBlocks.some(
      (block) =>
        (block.status === "pending" || block.status === "active") &&
        readBlockPayload(block).planItemId === getId(boss),
    );

  const reached = items
    .toSorted((a, b) => a.position - b.position)
    .flatMap((boss) => {
      const facts = readSelectedItemFacts(boss.facts)?.boss;

      if (
        !isChallengeReached({ boss, items }) ||
        inToday(boss) ||
        !facts ||
        facts.waiting ||
        facts.testedSkillIds.length === 0
      ) {
        return [];
      }

      return [{ id: getId(boss), minutes: facts.minutes, rematch: results.has(getId(boss)) }];
    });

  const dates = new Map<string, Date>();

  for (const date of days) {
    const budget = capacity(date);

    if (budget > 0) {
      for (const challenge of fundLeadingChallenges({
        budget,
        checkpoints: reached.filter((entry) => !dates.has(entry.id)),
      })) {
        dates.set(challenge.id, date);
      }
    }

    if (dates.size === reached.length) {
      break;
    }
  }

  const future = days.find((date) => capacity(date) > 0);

  return new Map(
    items
      .filter((boss) => boss.kind === "boss")
      .map((boss): [string, ChallengeTiming] => {
        if (inToday(boss)) {
          return [getId(boss), { date: toIsoDate(today), when: "nextSession" }];
        }

        const estimatedFor =
          dates.get(getId(boss)) ??
          (isChallengeReached({ boss, items }) ? future : boss.scheduledFor);

        const estimate = new Date(Math.max(tomorrow.getTime(), estimatedFor?.getTime() ?? 0));

        return [getId(boss), { date: toIsoDate(estimate), when: "date" }];
      }),
  );
}
