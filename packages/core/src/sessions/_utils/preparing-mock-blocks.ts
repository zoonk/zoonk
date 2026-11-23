import "server-only";
import { type ExamBlueprint, type Goal, prisma } from "@zoonk/db";
import { isScheduledPaperComplete } from "../../exams/mocks/_utils/mock-complete";
import { loadMockEssays } from "../../exams/mocks/_utils/mock-essays";
import { planWeeklyMock } from "../../exams/mocks/_utils/plan-weekly-mock";
import { readScheduledStructure } from "../../exams/mocks/_utils/read-mock-structure";
import { listMockWrittenRequests } from "../../exams/mocks/written-parts";
import { hasMockWriting } from "../../exams/mocks/written-test-plan";
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
      ? [
          {
            identity: checkpoint.mockIdentity,
            position: block.position ?? index,
            skillIds,
            written: checkpoint.written === true,
          },
        ]
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

  const asksWriting = mocks.some(
    ({ identity, written }) =>
      listMockWrittenRequests({
        shape: {
          day: identity?.day ?? null,
          kind: written || identity?.fullLength ? "full" : "half",
        },
        structure,
      }).length > 0,
  );

  const essays = asksWriting ? await loadMockEssays({ goal, userId: goal.userId }) : [];

  const positions = await Promise.all(
    mocks.map(async ({ position, identity, skillIds, written }) => {
      if (written) {
        const shape = { day: identity?.day ?? null, kind: "written" };
        return hasMockWriting({ essays, shape, structure }) ? [] : [position];
      }

      const plan = await planWeeklyMock({
        goal,
        graph: savedPlan?.graph,
        identity,
        skillIds,
        structure,
        today: localDate,
        userId: goal.userId,
      });

      const shape = { day: plan.day, kind: plan.fullLength ? "full" : "half" };

      return isScheduledPaperComplete(plan, hasMockWriting({ essays, shape, structure }))
        ? []
        : [position];
    }),
  );

  return new Set(positions.flat());
}
