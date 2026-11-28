import "server-only";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { uuidSchema } from "@zoonk/utils/uuid-schema";
import { z } from "zod";
import {
  type LanguageActivitiesDraft,
  draftLanguageActivities,
} from "../library/language/add-language-activities";
import { staffRead } from "./read";

/** Each lesson waits on two model calls, so a page stays short enough to finish in one request. */
const MAX_LESSONS = 10;

const languageActivitiesSchema = z.strictObject({
  lessonIds: z.array(uuidSchema()).min(1).max(MAX_LESSONS),
});

type FailedDraft = { lessonId: string; status: "failed"; reason: string };

async function draftLesson(lessonId: string): Promise<LanguageActivitiesDraft | FailedDraft> {
  const { data, error } = await safeAsync(() => draftLanguageActivities({ lessonId }));

  if (error) {
    logError("[staff language activities]", { error, lessonId });
    return { lessonId, reason: "Writing or checking failed. Retry this lesson.", status: "failed" };
  }

  return data;
}

async function draftPage(lessonIds: readonly string[]) {
  const lessons = await Promise.all([...new Set(lessonIds)].map((id) => draftLesson(id)));

  const fixes = lessons.flatMap((lesson) =>
    lesson.status === "drafted"
      ? [
          {
            changes: [{ id: lesson.lessonId, model: "Lesson", setScreens: lesson.setScreens }],
            reason: lesson.reason,
          },
        ]
      : [],
  );

  return { data: { fixes, lessons }, rows: lessons.length };
}

/**
 * Drafts the dialogue and pattern table each named published language lesson lacks, as content
 * fixes a staff person proposes. Nothing changes until another staff person approves them.
 */
export function draftStaffLanguageActivities({ input }: { input: unknown }) {
  return staffRead({
    call: { verb: "language-activities" },
    input,
    run: ({ lessonIds }) => draftPage(lessonIds),
    schema: languageActivitiesSchema,
  });
}
