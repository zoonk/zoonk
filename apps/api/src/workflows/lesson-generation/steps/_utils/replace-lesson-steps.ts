import {
  type CourseRevisionContext,
  withCurrentCourseRevision,
} from "@zoonk/core/workflows/internal/course-curriculum";
import { type Lesson, type TransactionClient } from "@zoonk/db";

/**
 * Replaces one lesson's visible step batch while holding a lock on the lesson.
 * Workflow steps may execute concurrently during durable recovery, so the
 * parent-row lock keeps two replacements from deleting and inserting across
 * each other while still allowing unrelated lessons to save in parallel. A
 * completed lesson is immutable because a stale replacement would invalidate
 * the step IDs referenced by learner attempts.
 */
export async function replaceLessonSteps({
  lessonId,
  saveSteps,
  revisionContext,
}: {
  lessonId: string;
  revisionContext: CourseRevisionContext;
  saveSteps: (transaction: TransactionClient) => Promise<void>;
}): Promise<void> {
  await withCurrentCourseRevision({
    context: revisionContext,
    operation: async (transaction) => {
      const [lesson] = await transaction.$queryRaw<Pick<Lesson, "generationStatus">[]>`
      SELECT "generation_status" AS "generationStatus"
      FROM "lessons"
      WHERE "id" = ${lessonId}::uuid
      FOR UPDATE
    `;

      if (!lesson || lesson.generationStatus === "completed") {
        return;
      }

      await transaction.step.deleteMany({ where: { lessonId } });
      await saveSteps(transaction);
    },
  });
}
