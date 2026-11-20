import "server-only";
import { type ExamBlueprint, type Goal } from "@zoonk/db";
import { planWeeklyMock } from "../../exams/mocks/_utils/plan-weekly-mock";
import { countPlannedQuestions } from "../../exams/mocks/mock-plan";
import { readBlockPayload } from "../block-payload";
import { type DayBlockInput } from "./day-block-view";
import { loadExamStructure } from "./exam-structure";

export async function loadPreparingMockPositions({
  blocks,
  blueprint,
  goal,
  localDate,
}: {
  blocks: readonly (Pick<DayBlockInput, "kind" | "payload"> &
    Partial<Pick<DayBlockInput, "position" | "status">>)[];
  blueprint?: ExamBlueprint | null;
  goal: Goal | null;
  localDate: Date;
}): Promise<Set<number>> {
  if (!goal) {
    return new Set();
  }

  const mocks = blocks.flatMap((block, index) => {
    if ((block.status && block.status !== "pending") || block.kind !== "checkpoint") {
      return [];
    }

    const { checkpoint, skillIds } = readBlockPayload(block);

    return checkpoint?.mock
      ? [{ identity: checkpoint.mockIdentity, position: block.position ?? index, skillIds }]
      : [];
  });

  if (mocks.length === 0) {
    return new Set();
  }

  const structure = await loadExamStructure(goal, { blueprint });

  const positions = await Promise.all(
    mocks.map(async ({ position, identity, skillIds }) => {
      const plan = await planWeeklyMock({
        goal,
        identity,
        skillIds,
        structure,
        today: localDate,
        userId: goal.userId,
      });
      return countPlannedQuestions(plan) < countPlannedQuestions(plan.outline) ? [position] : [];
    }),
  );

  return new Set(positions.flat());
}
