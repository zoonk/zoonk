import { type OwedFollowUp } from "@zoonk/core/follow-ups/contract";
import {
  countFollowUps,
  endFollowUp,
  listFollowUps,
  listLearnersWithOldFollowUps,
} from "@zoonk/core/follow-ups/rows";
import { requestLessonGenerationFor } from "@zoonk/core/lookahead/request-lesson-generation";
import { type LessonContentInput } from "../../lessons/lesson-content-workflow";
import { requestLiveLessonWriting } from "../../lessons/lesson-writing-request";

export async function listFollowUpsStep(userId: string): Promise<OwedFollowUp[]> {
  "use step";

  return listFollowUps(userId);
}

export async function endFollowUpStep(input: { id: string; revision: number }): Promise<void> {
  "use step";

  await endFollowUp(input);
}

export async function countFollowUpsStep(userId: string): Promise<number> {
  "use step";

  return countFollowUps(userId);
}

export async function listLearnersWithOldFollowUpsStep(): Promise<string[]> {
  "use step";

  return listLearnersWithOldFollowUps();
}

/** Writing a lesson ahead counts as its start, so the learner's allowance decides first. */
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
