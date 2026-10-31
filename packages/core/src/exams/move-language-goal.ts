import "server-only";
import { randomUUID } from "node:crypto";
import { type Goal, type TransactionClient, prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { revalidateCacheTags } from "../cache/revalidate-cache-tags";
import { getGoalsCacheTag, getLearningProfileCacheTag } from "../cache/tags";
import { insertGoalWithPlan, setActiveGoal } from "../goals/_utils/create-goal-records";
import { loadGoalViews } from "../goals/_utils/goal-view";
import { type GoalView } from "../goals/goal-contract";
import { unchanged, writeLearnerChange } from "../learner/_utils/write-learner-change";
import { toIsoDate } from "../plans/planner/plan-calendar";
import { getSession } from "../users/get-session";
import { detectLanguageExam } from "./language-exam";

/** Only `moved` starts the exam goal's research and curriculum, so a replay starts nothing twice. */
export type MoveLanguageGoalResult =
  | { goal: GoalView; status: "alreadyMoved" | "moved" }
  | { status: "noExam" | "notFound" | "unauthorized" };

type MoveOutcome =
  | { goalId: string; status: "alreadyMoved" | "moved" }
  | { status: "noExam" | "notFound" };

function findReplacement(tx: TransactionClient, goal: Goal) {
  return tx.goal.findFirst({
    select: { id: true },
    where: {
      details: { equals: goal.id, path: ["movedFromGoalId"] },
      status: { not: "archived" },
      userId: goal.userId,
    },
  });
}

async function replaceWithExamGoal({
  examName,
  goal,
  targetLanguage,
  tx,
}: {
  examName: string;
  goal: Goal;
  targetLanguage: string;
  tx: TransactionClient;
}): Promise<string> {
  const details = isJsonObject(goal.details) ? goal.details : {};
  const id = randomUUID();

  await tx.goal.update({ data: { status: "archived" }, where: { id: goal.id } });

  await insertGoalWithPlan(tx, {
    dailyMinutes: goal.dailyMinutes,
    draft: {
      details: { ...details, examName, examTarget: "score", movedFromGoalId: goal.id },
      kind: "exam",
      language: goal.language,
      prompt: goal.prompt,
      targetDate: goal.targetDate ? toIsoDate(goal.targetDate) : undefined,
      targetLanguage,
      title: examName,
    },
    id,
    input: { studyTime: goal.studyTime ?? undefined, timeZone: goal.timezone ?? undefined },
    testedLanguage: null,
    userId: goal.userId,
  });

  await setActiveGoal(tx, { activeGoalId: id, userId: goal.userId });
  return id;
}

/**
 * One learner write, so a failure partway leaves the language goal active, and a request sent
 * again gets the exam goal the first one made (`alreadyMoved`).
 */
export async function moveLanguageGoalToExam(goalId: string): Promise<MoveLanguageGoalResult> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  const userId = session.user.id;

  const outcome = await writeLearnerChange<MoveOutcome>(
    { planInputs: true, userId },
    async (tx) => {
      const goal = await tx.goal.findFirst({ where: { id: goalId, userId } });

      if (!goal) {
        return unchanged({ status: "notFound" });
      }

      if (goal.status !== "active") {
        const replacement = await findReplacement(tx, goal);

        return unchanged(
          replacement ? { goalId: replacement.id, status: "alreadyMoved" } : { status: "notFound" },
        );
      }

      const details = isJsonObject(goal.details) ? goal.details : {};
      const reason = typeof details.reason === "string" ? details.reason : "";
      const examName = goal.kind === "language" ? detectLanguageExam(reason) : null;

      const { targetLanguage } = goal;

      if (!examName || !targetLanguage) {
        return unchanged({ status: "noExam" });
      }

      const replacementId = await replaceWithExamGoal({ examName, goal, targetLanguage, tx });
      return { goalId: replacementId, status: "moved" };
    },
  );

  if (!("goalId" in outcome)) {
    return outcome;
  }

  if (outcome.status === "moved") {
    revalidateCacheTags([getGoalsCacheTag(userId), getLearningProfileCacheTag(userId)]);
  }

  const [exam, profile] = await Promise.all([
    prisma.goal.findUniqueOrThrow({ where: { id: outcome.goalId } }),
    prisma.userLearningProfile.findUnique({ select: { activeGoalId: true }, where: { userId } }),
  ]);

  const [goal] = await loadGoalViews({
    activeGoalId: profile?.activeGoalId ?? null,
    goals: [exam],
  });

  return goal ? { goal, status: outcome.status } : { status: "notFound" };
}
