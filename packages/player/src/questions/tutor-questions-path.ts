import { type TutorTarget } from "@zoonk/core/lesson-questions/contract";

export function getTutorQuestionsPath(target: TutorTarget): string {
  switch (target.kind) {
    case "chapter":
      return `/v1/chapters/${encodeURIComponent(target.chapterId)}/questions`;
    case "item":
      return `/v1/items/${encodeURIComponent(target.itemId)}/questions`;
    case "lesson":
      return `/v1/lessons/${encodeURIComponent(target.lessonId)}/questions`;
    case "mock":
      return `/v1/mocks/${encodeURIComponent(target.blockId)}/questions`;
    case "plan":
      return `/v1/goals/${encodeURIComponent(target.goalId)}/plan/questions`;
    case "subject":
      return `/v1/goals/${encodeURIComponent(target.goalId)}/subjects/${encodeURIComponent(target.subjectKey)}/questions`;
    default:
      return target satisfies never;
  }
}
