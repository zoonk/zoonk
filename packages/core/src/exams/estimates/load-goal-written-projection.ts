import "server-only";
import { type ExamStructure } from "../../library/exams/blueprint-contract";
import { listWrittenTasks } from "../../library/exams/written-tasks";
import { loadGoalScoreEstimate } from "./load-goal-estimate";
import { loadWrittenProjection } from "./written-projection";

export async function loadGoalWrittenProjection({
  blueprint,
  examPart,
  goal,
  structure,
  userId,
}: Omit<Parameters<typeof loadGoalScoreEstimate>[0], "ledgerMocks" | "completeObjective"> & {
  structure: ExamStructure | null;
  userId: string;
}) {
  if (!structure || listWrittenTasks({ structure }).length === 0) {
    return null;
  }

  const objective = await loadGoalScoreEstimate({
    blueprint,
    completeObjective: true,
    examPart,
    goal,
    ledgerMocks: [],
  });

  return loadWrittenProjection({ goalId: goal.id, objective, structure, userId });
}
