import "server-only";
import { prisma } from "@zoonk/db";
import { unchanged, writeLearnerChange } from "../../learner/_utils/write-learner-change";
import { parsePlanGraph } from "../../plans/planner/plan-state";
import { type CurriculumScope } from "./curriculum-scope";
import { type GoalCurriculumInputs, loadGoalCurriculumInputs } from "./goal-curriculum-inputs";
import { getGraphQuestions } from "./shared-graph-prompt";

/** Internal workflow bridge: the goal comes from its authorized run. */
export async function beginGoalCurriculum({
  goalId,
  scope,
}: {
  goalId: string;
  scope: Pick<CurriculumScope, "ownerId">;
}): Promise<GoalCurriculumInputs | null> {
  const inputs = await loadGoalCurriculumInputs(goalId);

  if (!inputs) {
    return null;
  }

  const curriculumQuestions = getGraphQuestions({ inputs, scope });

  await writeLearnerChange({ userId: inputs.goal.userId }, async (tx) => {
    const saved = await tx.goal.updateMany({
      data: { curriculumQuestions },
      where: { NOT: { curriculumQuestions: { equals: curriculumQuestions } }, id: inputs.goal.id },
    });

    return saved.count > 0 ? null : unchanged(null);
  });

  // An earlier edit is in this read; a later edit sees the recorded questions and owes a rebuild.
  return loadGoalCurriculumInputs(goalId);
}

export async function readGoalGraphState(
  goalId: string,
): Promise<"building" | "missing" | "saved"> {
  const goal = await prisma.goal.findUnique({
    select: { kind: true, plan: { select: { graph: true } } },
    where: { id: goalId },
  });

  if (!goal || goal.kind === "explain") {
    return "missing";
  }

  return parsePlanGraph(goal.plan?.graph).skills.length > 0 ? "saved" : "building";
}
