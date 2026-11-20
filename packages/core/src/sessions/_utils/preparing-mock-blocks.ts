import "server-only";
import { type ExamBlueprint, type Goal } from "@zoonk/db";
import { loadMockCard } from "../../checkpoints/_utils/mock-card";
import { readExamBlueprint } from "../../library/exams/read-exam-blueprint";
import { readBlockPayload } from "../block-payload";
import { type DayBlockInput } from "./day-block-view";

export async function loadPreparingMockPositions({
  blocks,
  blueprint,
  goal,
  localDate,
}: {
  blocks: readonly DayBlockInput[];
  blueprint?: ExamBlueprint | null;
  goal: Goal | null;
  localDate: Date;
}): Promise<Set<number>> {
  if (!goal) {
    return new Set();
  }

  const mocks = blocks.flatMap((block) => {
    if (block.status !== "pending" || block.kind !== "checkpoint") {
      return [];
    }

    const { checkpoint } = readBlockPayload(block);

    return checkpoint?.mock
      ? [{ identity: checkpoint.mockIdentity, position: block.position }]
      : [];
  });

  if (mocks.length === 0) {
    return new Set();
  }

  const exam =
    blueprint === undefined && goal.examBlueprintId
      ? await readExamBlueprint(goal.examBlueprintId)
      : (blueprint ?? null);

  const positions = await Promise.all(
    mocks.map(async ({ position, identity }) => {
      const card = await loadMockCard({
        blueprint: exam,
        date: localDate,
        goal,
        identity,
        today: localDate,
      });

      return card.preparing ? [position] : [];
    }),
  );

  return new Set(positions.flat());
}
