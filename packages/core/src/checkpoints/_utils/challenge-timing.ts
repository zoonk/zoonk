import { type Goal, type StudySessionBlock } from "@zoonk/db";
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

  const reached = items.flatMap((boss) => {
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

    return [{ id, minutes: facts.minutes, rematch: result !== undefined }];
  });

  const funded = new Set(
    (next ? fundLeadingChallenges({ budget: capacity(next), checkpoints: reached }) : []).map(
      (entry) => entry.id,
    ),
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
