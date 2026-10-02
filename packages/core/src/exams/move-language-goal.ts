import "server-only";
import { prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { createGoals } from "../goals/create-goals";
import { type GoalView } from "../goals/goal-contract";
import { findOwnedGoal } from "../learner/_utils/owned-goal";
import { toIsoDate } from "../plans/planner/plan-calendar";
import { detectLanguageExam } from "./language-exam";

export type MoveLanguageGoalResult =
  | { goal: GoalView; status: "moved" }
  | { status: "noExam" | "notFound" | "refused" | "unauthorized" };

/**
 * "Pass an exam" inside a language goal: when the learner's reason names a language certificate
 * (IELTS, DELE, Celpe-Bras…), the goal moves to an exam goal for it, keeping the language, what
 * onboarding understood and the schedule. The language goal is archived, not deleted; it comes
 * back if the exam goal can't be created.
 */
export async function moveLanguageGoalToExam(goalId: string): Promise<MoveLanguageGoalResult> {
  const owned = await findOwnedGoal(goalId);

  if (owned.status !== "ready") {
    return owned;
  }

  const { goal } = owned;
  const details = isJsonObject(goal.details) ? goal.details : {};
  const reason = typeof details.reason === "string" ? details.reason : "";
  const examName = goal.kind === "language" ? detectLanguageExam(reason) : null;

  if (!examName || !goal.targetLanguage) {
    return { status: "noExam" };
  }

  await prisma.goal.update({ data: { status: "archived" }, where: { id: goal.id } });

  const created = await createGoals(
    {
      dailyMinutes: goal.dailyMinutes,
      goals: [
        {
          details: { ...details, examName, movedFromGoalId: goal.id },
          kind: "exam",
          language: goal.language,
          prompt: goal.prompt,
          targetDate: goal.targetDate ? toIsoDate(goal.targetDate) : undefined,
          targetLanguage: goal.targetLanguage,
          title: examName,
        },
      ],
      studyTime: goal.studyTime ?? undefined,
      timeZone: goal.timezone ?? undefined,
    },
    // The exam goal takes the language goal's place, so it isn't another goal against limits.
    { replacesGoalId: goal.id },
  );

  const [exam] = created.status === "created" ? created.goals : [];

  if (!exam) {
    await prisma.goal.update({ data: { status: goal.status }, where: { id: goal.id } });
    return { status: "refused" };
  }

  return { goal: exam, status: "moved" };
}
