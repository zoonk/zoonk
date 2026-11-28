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

const BATCH_REASON =
  "Lets learners do each lesson's skill in the activity built for it, as lessons written since activities became common do.";

function toFix(lesson: Extract<LessonActivitiesDraft, { status: "drafted" }>) {
  return {
    changes: [
      { id: lesson.lessonId, model: "Lesson", setPlan: lesson.setPlan },
      { id: lesson.lessonId, model: "Lesson", setScreens: lesson.setScreens },
    ],
    reason: lesson.reason,
  };
}

/** `proposal` is a batch `staff fixes propose` takes as it is; `lessons` says what each lesson got. */
async function draftPage(lessonIds: readonly string[]) {
  const drafts = await Promise.all([...new Set(lessonIds)].map((id) => draftLesson(id)));
  const fixes = drafts.flatMap((draft) => (draft.status === "drafted" ? [toFix(draft)] : []));

  const lessons = drafts.map((draft) => {
    if (draft.status !== "drafted") {
      return draft;
    }

    const { setPlan: _plan, setScreens: _screens, ...summary } = draft;
    return summary;
  });

  return {
    data: { lessons, proposal: fixes.length > 0 ? { fixes, reason: BATCH_REASON } : null },
    rows: drafts.length,
  };
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
