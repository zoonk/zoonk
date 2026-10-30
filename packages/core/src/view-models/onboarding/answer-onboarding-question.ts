import "server-only";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import {
  getGoalsCacheTag,
  getLearnerModelCacheTag,
  getLearningProfileCacheTag,
} from "../../cache/tags";
import {
  type MoveLanguageGoalResult,
  moveLanguageGoalToExam,
} from "../../exams/move-language-goal";
import { type GoalView } from "../../goals/goal-contract";
import { findOwnedGoal } from "../../learner/_utils/owned-goal";
import { scheduleMemoryUpdate } from "../../memory/update-memory-from-activity";
import { followPlanToday } from "../../plans/_utils/follow-plan-today";
import { loadPlanAtToken } from "../../plans/_utils/plan-token";
import { settleNewPlan } from "../../plans/_utils/recommended-bases";
import { afterPlanInputWrite } from "../../plans/plan-conflict";
import { refreshGoalPlan } from "../../plans/refresh-goal-plan";
import { updateLearningProfile } from "../../profile/update-learning-profile";
import { saveAnswerInputs } from "./_utils/save-onboarding-answer";
import { type OnboardingAnswerInput } from "./onboarding-contract";

/**
 * A saved answer says which goal onboarding goes on with: `movedTo` is the exam goal a language
 * goal moved to ("Pass an exam" naming a certificate), null when the goal stays. `created` is true
 * only for the request that created it, whose caller starts its research and curriculum. A schedule
 * whose day or weekend is shorter than `minutes`, the least the `goals` typed together need, isn't
 * saved.
 */
export type OnboardingAnswerResult =
  | { movedTo: { created: boolean; goal: GoalView } | null; status: "saved" }
  | { goals: number; minutes: number; status: "dayTooShort" }
  | { status: "invalid" }
  | { status: "notFound" }
  | { status: "unauthorized" };

/** The exam goal a move gave, and whether this request created it. */
function toMovedGoal(moved: MoveLanguageGoalResult) {
  return moved.status === "moved" || moved.status === "alreadyMoved"
    ? { created: moved.status === "moved", goal: moved.goal }
    : null;
}

/** The buddy belongs to the learner, not the goal, so it's saved on the profile. */
async function saveProfileAnswer(input: OnboardingAnswerInput): Promise<"invalid" | "saved"> {
  if (input.question !== "buddy") {
    return "saved";
  }

  const result = await updateLearningProfile({ buddy: input.buddy });
  return result.status === "updated" ? "saved" : "invalid";
}

async function followSavedPlan(goalId: string): Promise<void> {
  await afterPlanInputWrite(async () => {
    const context = await loadPlanAtToken(goalId);

    if (context) {
      await followPlanToday({ context });
    }
  });
}

/** Requires an owned goal; remembers skipped answers too, and schedule answers settle its plan and shared time. A language goal whose reason names a certificate moves to an exam goal for it. */
export async function answerOnboardingQuestion({
  goalId,
  input,
}: {
  goalId: string;
  input: OnboardingAnswerInput;
}): Promise<OnboardingAnswerResult> {
  const owned = await findOwnedGoal(goalId);

  if (owned.status !== "ready") {
    return owned;
  }

  const { goal } = owned;

  // A reason answer sent again after its goal moved (its response was lost) goes on with the
  // exam goal, without writing to the archived one.
  if (input.question === "reason" && goal.kind === "language" && goal.status !== "active") {
    const movedTo = toMovedGoal(await moveLanguageGoalToExam(goalId));

    if (movedTo) {
      return { movedTo, status: "saved" };
    }
  }

  if ((await saveProfileAnswer(input)) !== "saved") {
    return { status: "invalid" };
  }

  const saved = await saveAnswerInputs({ goal, input });

  if (saved.status === "dayTooShort") {
    return saved;
  }

  if (saved.status !== "saved") {
    return { status: saved.status };
  }

  revalidateCacheTags([
    getGoalsCacheTag(goal.userId),
    getLearningProfileCacheTag(goal.userId),
    getLearnerModelCacheTag(goal.userId),
  ]);

  // Schedule is last: personalization can read all answers and the age-based memory choice before first lessons.
  if (input.question === "schedule") {
    await settleNewPlan({ goalId });

    await Promise.all(
      saved.goalIds
        .filter((id) => id !== goalId)
        .map(async (id) => {
          await refreshGoalPlan({ goalId: id, mode: "forced", onConflict: "yield" });
          await followSavedPlan(id);
        }),
    );

    scheduleMemoryUpdate({
      goalId,
      source: { goalId, kind: "onboarding" },
      timeZone: input.timeZone,
      userId: goal.userId,
    });
  } else {
    await refreshGoalPlan({
      goalId,
      mode: input.question === "targetDate" ? "forced" : "automatic",
      onConflict: "yield",
    });
  }

  if (input.question === "schedule" || input.question === "targetDate") {
    await followSavedPlan(goalId);
  }

  // "Pass an exam" inside a language goal: a reason naming a certificate moves it to an exam goal.
  if (input.question === "reason" && goal.kind === "language") {
    return { movedTo: toMovedGoal(await moveLanguageGoalToExam(goalId)), status: "saved" };
  }

  return { movedTo: null, status: "saved" };
}
