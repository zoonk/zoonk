import "server-only";
import { type ExamBlueprint, type Goal, prisma } from "@zoonk/db";
import { isScheduledPaperComplete } from "../../exams/mocks/_utils/mock-complete";
import { planWeeklyMock } from "../../exams/mocks/_utils/plan-weekly-mock";
import { readScheduledStructure } from "../../exams/mocks/_utils/read-mock-structure";
import { readBlockPayload } from "../block-payload";
import { type DayBlockInput } from "./day-block-view";

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

  const [exam, savedPlan] = await Promise.all([
    blueprint === undefined && goal.examBlueprintId
      ? prisma.examBlueprint.findUnique({ where: { id: goal.examBlueprintId } })
      : blueprint,
    prisma.plan.findUnique({ select: { graph: true, settings: true }, where: { goalId: goal.id } }),
  ]);

  const structure = readScheduledStructure({
    blueprint: exam ?? null,
    date: localDate,
    goal,
    settings: savedPlan?.settings,
  });

  const positions = await Promise.all(
    mocks.map(async ({ position, identity, skillIds }) => {
      const plan = await planWeeklyMock({
        goal,
        identity,
        paperPlan: savedPlan ?? undefined,
        skillIds,
        structure,
        today: localDate,
        userId: goal.userId,
      });

      return isScheduledPaperComplete(plan) ? [] : [position];
    }),
  );

  return new Set(positions.flat());
}
