import { type Goal, type StudySessionBlock } from "@zoonk/db";
import { hasOverduePlanWork } from "../../plans/_utils/left-work";
import { readSelectedItemFacts } from "../../plans/_utils/selected-item-contract";
import { addDays, daysBetween, toIsoDate } from "../../plans/planner/plan-calendar";
import { DAYS_PER_WEEK, type PlanSettings } from "../../plans/planner/plan-state";
import { getGoalDayMinutes } from "../../sessions/_utils/day-minutes";
import { isMockOnlyDay } from "../../sessions/_utils/day-mock";
import { findPlannedReview } from "../../sessions/_utils/day-review";
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

export function getChallengeTimings({
  goal,
  items,
  settings,
  today,
  todayBlocks = [],
  savedDay = false,
  results = new Map(),
}: {
  goal: Pick<Goal, "dailyMinutes" | "kind" | "targetDate">;
  items: readonly TimingItem[];
  settings: PlanSettings;
  today: Date;
  todayBlocks?: readonly Pick<StudySessionBlock, "payload" | "status">[];
  savedDay?: boolean;
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

  const retainedReview =
    !hasOverduePlanWork({ items, today }) && findPlannedReview({ items, today }) !== null;

  const capacity = (date: Date) => {
    const blocked =
      (date.getTime() === today.getTime() && retainedReview) ||
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

  const inToday = (boss: TimingItem) =>
    boss.status === "todo" &&
    todayBlocks.some(
      (block) =>
        (block.status === "pending" || block.status === "active") &&
        readBlockPayload(block).planItemId === (boss.id ?? boss.key ?? ""),
    );

  const reached = items
    .toSorted((a, b) => a.position - b.position)
    .flatMap((boss) => {
      const id = boss.id ?? boss.key ?? "";
      const facts = readSelectedItemFacts(boss.facts)?.boss;
      const result = results.get(id);

      if (
        !isChallengeReached({ boss, items }) ||
        inToday(boss) ||
        !facts ||
        facts.waiting ||
        facts.testedSkillIds.length === 0 ||
        (result && result.localDate.getTime() === today.getTime())
      ) {
        return [];
      }

      return [{ id, minutes: facts.minutes, rematch: result !== undefined }];
    });

  const dates = new Map<string, Date>();

  for (const date of days) {
    const budget = capacity(date);

    if ((!savedDay || date > today) && budget > 0) {
      const checkpoints = reached.filter((entry) => !dates.has(entry.id));

      for (const entry of fundLeadingChallenges({ budget, checkpoints })) {
        dates.set(entry.id, date);
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
