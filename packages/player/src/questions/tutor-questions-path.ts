import { type TutorTarget } from "@zoonk/core/lesson-questions/contract";

/** Where a thread's questions live in the public API, by what the thread is about. */
export function getTutorQuestionsPath(target: TutorTarget): string {
  switch (target.kind) {
    case "chapter":
      return `/v1/chapters/${encodeURIComponent(target.chapterId)}/questions`;
    case "lesson":
      return `/v1/lessons/${encodeURIComponent(target.lessonId)}/questions`;
    case "mock":
      return `/v1/mocks/${encodeURIComponent(target.blockId)}/questions`;
    case "plan":
      return `/v1/goals/${encodeURIComponent(target.goalId)}/plan/questions`;
    default:
      return target satisfies never;
  }
}
