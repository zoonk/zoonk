import { type TransactionClient } from "@zoonk/db";
import { readStagedLessonVersion } from "../../../library/lessons/lesson-versions";
import { PRIVATE_CONTENT } from "./resolved-change";

export async function lessonProblem(
  db: TransactionClient,
  lessonId: string,
): Promise<string | null> {
  const lesson = await db.lesson.findUnique({
    select: { contentStatus: true, ownerId: true, visibility: true },
    where: { id: lessonId },
  });

  if (!lesson) {
    return `No Lesson with id ${lessonId}.`;
  }

  if (lesson.visibility === "private" || lesson.ownerId) {
    return PRIVATE_CONTENT;
  }

  if (lesson.contentStatus !== "completed") {
    return "Only a published lesson can be fixed; this one is still being written.";
  }

  return (await readStagedLessonVersion(lessonId, db))
    ? "A new version of this lesson is waiting to replace it; fix it once that version is published."
    : null;
}
