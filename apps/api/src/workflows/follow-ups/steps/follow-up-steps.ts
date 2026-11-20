import { type OwedFollowUp } from "@zoonk/core/follow-ups/contract";
import {
  endFollowUp,
  listFollowUps,
  listLearnersWithOldFollowUps,
} from "@zoonk/core/follow-ups/rows";
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

export async function requestLessonWritingStep({
  lessonId,
  userId,
}: {
  lessonId: string;
  userId: string;
}): Promise<LessonContentInput | null> {
  "use step";

  const writing = await requestLiveLessonWriting({
    lessonId,
    request: () => requestLessonGenerationFor({ lessonId, userId }),
  });

  return writing.status === "start"
    ? { analytics: writing.analytics, forExam: writing.forExam, lessonId, wait: "learner" }
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
