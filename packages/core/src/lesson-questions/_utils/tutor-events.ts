import "server-only";
import { type AnalyticsEvent } from "../../analytics/events";
import { type CreateLessonQuestionInput } from "../contract";
import { type TutorSubject } from "./tutor-subject";

const LESSON_SCOPES = { answer: "answer", lesson: "lesson", step: "screen" } as const;

function getLessonScope(context: CreateLessonQuestionInput["context"]) {
  return context.kind === "answer" || context.kind === "step"
    ? LESSON_SCOPES[context.kind]
    : "lesson";
}

export function getTutorAskedEvent({
  input,
  subject,
}: {
  input: CreateLessonQuestionInput;
  subject: TutorSubject;
}): AnalyticsEvent {
  switch (subject.kind) {
    case "chapter":
      return {
        name: "Tutor Asked",
        properties: { chapter_id: subject.chapterId, scope: "chapter" },
      };
    case "item":
      return { name: "Tutor Asked", properties: { item_id: subject.item.id, scope: "item" } };
    case "lesson":
      return {
        name: "Tutor Asked",
        properties: { lesson_id: subject.lesson.id, scope: getLessonScope(input.context) },
      };
    case "mock":
      return { name: "Tutor Asked", properties: { mock_id: subject.mockExamId, scope: "mock" } };
    case "plan":
      return { name: "Tutor Asked", properties: { goal_id: subject.goal.id, scope: "plan" } };
    case "subject":
      return {
        name: "Tutor Asked",
        properties: {
          goal_id: subject.goal.id,
          scope: "subject",
          subject_key: subject.syllabusSubject.key,
        },
      };
    default:
      return subject satisfies never;
  }
}
