import "server-only";
import { type TransactionClient } from "@zoonk/db";
import { readBlueprintContent } from "../../library/exams/save-exam-blueprint";
import { readEssayContent } from "./_utils/essay-content";
import { listPracticeWritingTasks } from "./_utils/practice-writing-tasks";
import { matchesWritingTaskBasis } from "./_utils/writing-task-basis";

export type WritingRequest = {
  count: number;
  skillId?: string;
  taskKey: string;
  unit: "answer" | "drill";
};

export async function findWritingPrompts({
  goalId,
  requests,
  tx,
  userId,
}: {
  goalId: string;
  requests: WritingRequest[];
  tx: TransactionClient;
  userId: string;
}): Promise<
  { itemIds: string[]; status: "ready" } | { requests: WritingRequest[]; status: "missing" }
> {
  const bank = await loadUnseenWritingPrompts({ goalId, requests, tx, userId });
  const used = new Set<string>();
  const missing: WritingRequest[] = [];
  const itemIds: string[] = [];

  for (const request of requests) {
    const matches = bank
      .filter(
        ({ id, writing }) =>
          !used.has(id) &&
          writing.taskKey === request.taskKey &&
          writing.unit === request.unit &&
          (request.unit === "answer" ||
            (writing.assessedSkillIds.length === 1 &&
              writing.assessedSkillIds[0] === request.skillId)),
      )
      .slice(0, request.count);

    for (const { id } of matches) {
      used.add(id);
      itemIds.push(id);
    }

    if (matches.length < request.count) {
      missing.push({ ...request, count: request.count - matches.length });
    }
  }

  return missing.length > 0
    ? { requests: missing, status: "missing" }
    : { itemIds, status: "ready" };
}

export async function loadUnseenWritingPrompts({
  goalId,
  requests,
  tx,
  userId,
}: {
  goalId: string;
  requests?: readonly WritingRequest[];
  tx: TransactionClient;
  userId: string;
}) {
  const goal = await tx.goal.findFirst({
    select: { examBlueprint: true, language: true },
    where: { id: goalId, kind: "exam", userId },
  });

  const blueprint = goal?.examBlueprint;

  if (!blueprint || (blueprint.ownerId !== userId && blueprint.visibility !== "public")) {
    return [];
  }

  const tasks = new Map(
    listPracticeWritingTasks({
      classTest: Boolean(blueprint.ownerId),
      structure: readBlueprintContent(blueprint).structure,
    }).map((task) => [task.key, task]),
  );

  if (tasks.size === 0) {
    return [];
  }

  const items = await tx.item.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    select: { content: true, format: true, id: true },
    where: {
      OR: requests?.map(({ taskKey, unit }) => ({
        AND: [
          { content: { equals: taskKey, path: ["writing", "taskKey"] } },
          { content: { equals: unit, path: ["writing", "unit"] } },
        ],
      })),
      attempts: { none: { userId } },
      examBlueprintId: blueprint.id,
      field: null,
      format: "essay",
      language: goal.language,
      retiredAt: null,
      setId: null,
      skill: { ownerId: blueprint.ownerId, visibility: blueprint.visibility },
    },
  });

  const exposures = await tx.writingAdmission.findMany({
    select: { itemIds: true },
    where: { itemIds: { hasSome: items.map(({ id }) => id) }, userId },
  });

  const used = new Set(exposures.flatMap(({ itemIds }) => itemIds));

  return items.flatMap((item) => {
    const writing = readEssayContent(item)?.writing;
    const task = writing && tasks.get(writing.taskKey);

    return writing &&
      task &&
      !used.has(item.id) &&
      matchesWritingTaskBasis({ prompt: writing, task })
      ? [{ id: item.id, writing }]
      : [];
  });
}
