import "server-only";
import { type ExamBlueprint, prisma } from "@zoonk/db";
import { listPracticeWritingTasks } from "../../exams/essays/_utils/practice-writing-tasks";
import { indexWritingTasks } from "../../exams/essays/_utils/writing-task-positions";
import { readExamBlueprint } from "../../library/exams/read-exam-blueprint";
import { readBlueprintContent } from "../../library/exams/save-exam-blueprint";
import { readBlockPayload } from "../block-payload";
import { type StudySessionRow } from "./study-session-access";

export function listBlueprintWritingTasks(blueprint?: ExamBlueprint | null) {
  return blueprint
    ? listPracticeWritingTasks({
        classTest: Boolean(blueprint.ownerId),
        structure: readBlueprintContent(blueprint).structure,
      })
    : [];
}

export function getBlueprintWritingTasks(blueprint?: ExamBlueprint | null) {
  return indexWritingTasks(listBlueprintWritingTasks(blueprint));
}

export async function loadWritingTask({
  blueprintId,
  taskKey,
}: {
  blueprintId: string | null | undefined;
  taskKey: string;
}) {
  const blueprint = blueprintId ? await readExamBlueprint(blueprintId) : null;
  return getBlueprintWritingTasks(blueprint).get(taskKey);
}

export async function loadSessionWritingTasks({
  blueprint: knownBlueprint,
  fresh,
  session,
}: {
  blueprint?: ExamBlueprint | null;
  fresh?: boolean;
  session: Pick<StudySessionRow, "blocks" | "goal">;
}) {
  const writingBlocks = session.blocks.flatMap((block) => {
    const { writing } = readBlockPayload(block);
    return block.kind === "produce" && writing ? [{ block, writing }] : [];
  });

  const blueprintId = session.goal?.examBlueprintId;

  const blueprint =
    knownBlueprint === undefined && blueprintId && writingBlocks.length > 0
      ? await (fresh
          ? prisma.examBlueprint.findUnique({ where: { id: blueprintId } })
          : readExamBlueprint(blueprintId))
      : knownBlueprint;

  const tasks = listBlueprintWritingTasks(blueprint);
  const keys = new Set(tasks.map(({ key }) => key));

  const removed = new Set(
    writingBlocks.flatMap(({ block, writing }) =>
      blueprintId &&
      block.status !== "completed" &&
      !writing.admissionId &&
      !writing.draft &&
      !keys.has(writing.taskKey)
        ? [block.id]
        : [],
    ),
  );

  return { blueprint, removed, writingTasks: indexWritingTasks(tasks) };
}
