import { type OwedFollowUp } from "@zoonk/core/follow-ups/contract";
import {
  countFollowUps,
  endFollowUp,
  listFollowUps,
  listLearnersWithOldFollowUps,
} from "@zoonk/core/follow-ups/rows";
import { requestLessonGenerationFor } from "@zoonk/core/lookahead/request-lesson-generation";
import { requestChapterMindMapFor } from "@zoonk/core/mind-maps/request";
import { type LessonContentInput } from "../../lessons/lesson-content-workflow";
import { requestLiveLessonWriting } from "../../lessons/lesson-writing-request";
import {
  type ChapterMindMapInput,
  toChapterMindMapInput,
} from "../../mind-maps/chapter-mind-map-input";

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

/** An owed map passes the learner's own admission, as their tap would; null when there's nothing to start. */
export async function requestOwedMindMapStep({
  chapterId,
  goalId,
  userId,
}: {
  chapterId: string;
  goalId: string;
  userId: string;
}): Promise<ChapterMindMapInput | null> {
  "use step";

  const request = await requestChapterMindMapFor({ chapterId, goalId, userId });

  return request.status === "start" ? toChapterMindMapInput({ chapterId, request }) : null;
}
