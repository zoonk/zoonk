import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { type EntitlementTier } from "../../../entitlements/contract";
import { getActiveGoalLimit } from "../../../entitlements/limits";
import { type GoalCreateInput, type GoalDraft } from "../../../goals/goal-contract";
import { getTargetDateBounds } from "../../../plans/target-date-range";
import { type UnderstoodGoalView, type UnderstoodSchedule } from "../onboarding-contract";
import { parseStoredUnderstanding } from "./onboarding-draft";
import { readDetail } from "./onboarding-goals";

export type WaitingGoal = { id: string; input: GoalCreateInput; locked: boolean };

type StartedCard = { firstGoals: number; live: boolean; places: Set<number> };

function readPlace(goal: Goal): number | null {
  const place = isJsonObject(goal.details) ? goal.details.onboardingPlace : null;
  return typeof place === "number" ? place : null;
}

/**
 * "Looks right" starts the first goals of a card, and a goal started later from its waiting row
 * keeps its place. A goal that moved to its exam goal took its place, so it counts once.
 */
function findStartedCards(goals: readonly Goal[]): Map<string, StartedCard> {
  return goals.reduce((cards, goal) => {
    const onboardingId = readDetail(goal.details, "onboardingId");

    if (!onboardingId) {
      return cards;
    }

    const card = cards.get(onboardingId) ?? { firstGoals: 0, live: false, places: new Set() };
    const place = readPlace(goal);
    const moved = goal.replacesGoalId !== null;

    return cards.set(onboardingId, {
      firstGoals: card.firstGoals + (place === null && !moved ? 1 : 0),
      live: card.live || goal.status !== "archived",
      places: place === null ? card.places : card.places.add(place),
    });
  }, new Map<string, StartedCard>());
}

/** Its setup asks the day's time again, which then splits it with the goals typed with it. */
function toWaitingInput({
  goal,
  place,
  schedule,
  today,
}: {
  goal: UnderstoodGoalView;
  place: number;
  schedule: UnderstoodSchedule;
  today: string;
}): GoalCreateInput {
  const { details = {}, targetDate } = goal.draft;
  const answered = Array.isArray(details.answered) ? details.answered : [];

  const draft: GoalDraft = {
    ...goal.draft,
    details: {
      ...details,
      answered: answered.filter((answer) => answer !== "schedule"),
      onboardingPlace: place,
    },
    targetDate: targetDate && targetDate >= getTargetDateBounds(today).min ? targetDate : undefined,
  };

  return { dailyMinutes: schedule.dailyMinutes, goals: [draft] };
}

/**
 * The goals of a card past those the learner's plan followed ("ENEM and English" on Free starts
 * ENEM), kept on its draft to start without typing them again. One goes once it's started, and
 * all of them once every goal started from that card is archived.
 */
export async function findWaitingGoals({
  goals,
  tier,
  today,
  userId,
}: {
  goals: readonly Goal[];
  tier: EntitlementTier;
  today: string;
  userId: string;
}): Promise<WaitingGoal[]> {
  const cards = findStartedCards(goals);
  const liveIds = [...cards].flatMap(([id, card]) => (card.live ? [id] : []));

  if (liveIds.length === 0) {
    return [];
  }

  const drafts = await prisma.onboardingDraft.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, understanding: true },
    where: { id: { in: liveIds }, status: "understood", userId },
  });

  const limit = getActiveGoalLimit(tier);
  const active = goals.filter((goal) => goal.status === "active" && goal.kind !== "explain");
  const locked = limit !== null && active.length >= limit;

  return drafts.flatMap((draft) => {
    const understanding = parseStoredUnderstanding(draft.understanding);
    const card = cards.get(draft.id);

    if (understanding?.status !== "goals" || !card) {
      return [];
    }

    return understanding.goals.flatMap((goal, place) =>
      place < card.firstGoals || card.places.has(place)
        ? []
        : [
            {
              id: `${draft.id}:${place}`,
              input: toWaitingInput({ goal, place, schedule: understanding.schedule, today }),
              locked,
            },
          ],
    );
  });
}
