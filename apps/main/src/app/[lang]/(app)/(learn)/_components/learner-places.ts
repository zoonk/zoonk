import "server-only";
import { listCurrentUserGoals } from "@zoonk/core/goals/list-current-user";
import { listGoalMindMaps } from "@zoonk/core/mind-maps/list";
import { listCurrentUserMistakes } from "@zoonk/core/mistakes/list-current-user";
import { getSavedTodayQueue } from "@zoonk/core/sessions/saved-today-queue";
import { getLanguageTodayView } from "@zoonk/core/view-models/language/today";

/**
 * The places the sidebar's Study group and the palette's "Go to" list besides the tabs, for the
 * active goal: its mistakes notebook (with how many are ready to practice), an exam's page, a language goal's
 * speaking paper and the mind maps, each only when the goal has it.
 */
export type LearnerPlaces = {
  exam: boolean;
  mindMaps: boolean;
  readyMistakes: number;
  speaking: boolean;
};

/** A goal without any of its own places: the palette's too, when they can't be read. */
export const NO_PLACES: LearnerPlaces = {
  exam: false,
  mindMaps: false,
  readyMistakes: 0,
  speaking: false,
};

async function countReadyMistakes(goalId: string): Promise<number> {
  const result = await listCurrentUserMistakes({ goalId, limit: 1, offset: 0, status: "open" });
  return result.status === "ready" ? result.availability.ready : 0;
}

async function hasMindMaps(): Promise<boolean> {
  const result = await listGoalMindMaps();
  return result.status === "ready" && result.mindMaps.chapters.length > 0;
}

/** A language goal preparing an exam with a speaking paper practices it on its own page. */
async function hasSpeakingPaper(goal: { id: string; kind: string }): Promise<boolean> {
  if (goal.kind !== "language") {
    return false;
  }

  // Read as Today reads it, so Today's page and the sidebar share one read.
  const result = await getLanguageTodayView({ goalId: goal.id });
  return result.status === "ready" && result.today.speaking !== null;
}

export async function getLearnerPlaces(): Promise<LearnerPlaces> {
  const list = await listCurrentUserGoals();
  const goal = list?.goals.find((item) => item.id === list.activeGoalId);

  if (!goal) {
    return NO_PLACES;
  }

  const [readyMistakes, mindMaps, speaking] = await Promise.all([
    countReadyMistakes(goal.id),
    hasMindMaps(),
    hasSpeakingPaper(goal),
  ]);

  return { exam: goal.kind === "exam", mindMaps, readyMistakes, speaking };
}

/**
 * Today's session as the sidebar and the palette show it: how many blocks are left, and the one up
 * next (its lesson's title, when it has one, and its minutes) for "Continue". Null before the day
 * is saved, without a goal, or for a paused goal.
 *
 * The core private read is shared by both displays; it never builds the day or settles the plan.
 */
export async function getTodayQueue() {
  return getSavedTodayQueue();
}

export type TodayQueue = NonNullable<Awaited<ReturnType<typeof getTodayQueue>>>;
