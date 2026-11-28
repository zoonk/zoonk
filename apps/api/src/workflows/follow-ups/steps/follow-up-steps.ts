import { type FollowUp, type OwedFollowUp } from "@zoonk/core/follow-ups/contract";
import {
  endFollowUp,
  listFollowUps,
  listLearnersWithOldFollowUps,
} from "@zoonk/core/follow-ups/rows";
import { ensureQuickLessons } from "@zoonk/core/library/quick-lessons";
import { ensureSecondTake } from "@zoonk/core/library/second-takes/ensure";
import { requestLessonGenerationFor } from "@zoonk/core/lookahead/request-lesson-generation";
import { requestChapterMindMapFor } from "@zoonk/core/mind-maps/request";
import { type LessonContentInput } from "../../lessons/lesson-content-workflow";
import { requestLiveLessonWriting } from "../../lessons/lesson-writing-request";

export async function listFollowUpsStep(
  userId: string,
  started: Pick<OwedFollowUp, "id" | "revision">[] = [],
): Promise<OwedFollowUp[]> {
  "use step";

  return listFollowUps(userId, started);
}

export async function endFollowUpStep(input: { id: string; revision: number }): Promise<void> {
  "use step";

  await endFollowUp(input);
}

export async function listLearnersWithOldFollowUpsStep(): Promise<string[]> {
  "use step";

  return listLearnersWithOldFollowUps();
}

type OwedLesson = Extract<FollowUp, { kind: "writeLesson" | "writeSecondTake" }>["input"];

async function findOwedLessonId(input: OwedLesson, userId: string) {
  if ("skillId" in input) {
    return ensureSecondTake({ skillId: input.skillId, userId });
  }

  if ("quickSkillId" in input) {
    const lessons = await ensureQuickLessons({ skillIds: [input.quickSkillId] });
    return lessons.get(input.quickSkillId)?.lessonId;
  }

  return input.lessonId;
}

export async function requestLessonWritingStep(
  input: OwedLesson,
  userId: string,
): Promise<LessonContentInput | null> {
  "use step";

  const lessonId = await findOwedLessonId(input, userId);

  if (!lessonId) {
    return null;
  }

  const writing = await requestLiveLessonWriting({
    lessonId,
    request: () =>
      requestLessonGenerationFor({ allowSecondTake: "skillId" in input, lessonId, userId }),
  });

  return writing.status === "start"
    ? {
        analytics: writing.analytics,
        forExam: writing.forExam,
        lessonId,
        remedial: !("lessonId" in input),
        wait: "learner",
      }
    : null;
}

/** An owed map passes the learner's own admission, as their tap would, which owes its run once admitted. */
export async function requestOwedMindMapStep(input: {
  chapterId: string;
  goalId: string;
  userId: string;
}): Promise<void> {
  "use step";

  await requestChapterMindMapFor(input);
}
