import "server-only";
import { type ExamBlueprint, prisma } from "@zoonk/db";
import { listPracticeWritingTasks } from "../../exams/essays/_utils/practice-writing-tasks";
import { readExamBlueprint } from "../../library/exams/read-exam-blueprint";
import { readBlueprintContent } from "../../library/exams/save-exam-blueprint";
import { readBlockPayload } from "../block-payload";
import { type StudySessionRow } from "./study-session-access";

export async function findRemovedWritingBlocks({
  blueprint,
  fresh,
  session,
}: {
  blueprint?: ExamBlueprint | null;
  fresh?: boolean;
  session: Pick<StudySessionRow, "blocks" | "goal">;
}) {
  const candidates = session.blocks.flatMap((block) => {
    if (block.kind !== "produce" || block.status === "completed") {
      return [];
    }

    const { writing } = readBlockPayload(block);

    return writing && !writing.admissionId && !writing.draft
      ? [{ id: block.id, taskKey: writing.taskKey }]
      : [];
  });

  const blueprintId = session.goal?.examBlueprintId;

  if (!blueprintId || candidates.length === 0) {
    return new Set<string>();
  }

  const current =
    blueprint === undefined
      ? await (fresh
          ? prisma.examBlueprint.findUnique({ where: { id: blueprintId } })
          : readExamBlueprint(blueprintId))
      : blueprint;

  const keys = new Set(
    current
      ? listPracticeWritingTasks({
          classTest: Boolean(current.ownerId),
          structure: readBlueprintContent(current).structure,
        }).map(({ key }) => key)
      : [],
  );

  return new Set(candidates.filter(({ taskKey }) => !keys.has(taskKey)).map(({ id }) => id));
}
