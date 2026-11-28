import "server-only";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { uuidSchema } from "@zoonk/utils/uuid-schema";
import { z } from "zod";
import {
  type LessonActivitiesDraft,
  draftLessonActivities,
} from "../library/lessons/add-lesson-activities";
import { staffRead } from "./read";

/** Each lesson waits on up to four model calls in a row, so a page finishes in one request. */
const MAX_LESSONS = 5;

const lessonActivitiesSchema = z.strictObject({
  lessonIds: z.array(uuidSchema()).min(1).max(MAX_LESSONS),
});

type FailedDraft = { lessonId: string; status: "failed"; reason: string };

async function draftLesson(lessonId: string): Promise<LessonActivitiesDraft | FailedDraft> {
  const { data, error } = await safeAsync(() =>
    draftLessonActivities({ analytics: { contentScope: "shared" }, lessonId }),
  );

  if (error) {
    logError("[staff lesson activities]", { error, lessonId });

    return {
      lessonId,
      reason: "Planning, writing or checking failed. Retry this lesson.",
      status: "failed",
    };
  }

  return data;
}

async function draftPage(lessonIds: readonly string[]) {
  const lessons = await Promise.all([...new Set(lessonIds)].map((id) => draftLesson(id)));

  const fixes = lessons.flatMap((lesson) =>
    lesson.status === "drafted"
      ? [
          {
            changes: [
              { id: lesson.lessonId, model: "Lesson", setPlan: lesson.setPlan },
              { id: lesson.lessonId, model: "Lesson", setScreens: lesson.setScreens },
            ],
            reason: lesson.reason,
          },
        ]
      : [],
  );

  return { data: { fixes, lessons }, rows: lessons.length };
}

/**
 * Drafts the activities each named published lesson's skill calls for, as content fixes a staff
 * person proposes. Nothing changes until another staff person approves them.
 */
export function draftStaffLessonActivities({ input }: { input: unknown }) {
  return staffRead({
    call: { verb: "lesson-activities" },
    input,
    run: ({ lessonIds }) => draftPage(lessonIds),
    schema: lessonActivitiesSchema,
  });
}
