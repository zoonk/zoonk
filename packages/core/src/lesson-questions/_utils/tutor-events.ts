import "server-only";
import { type AnalyticsEvent } from "../../analytics/events";
import { type CreateLessonQuestionInput } from "../contract";
import { type TutorSubject } from "./tutor-subject";

/** The lesson tutor's scopes as analytics names them: a step is one screen. */
const LESSON_SCOPES = { answer: "answer", lesson: "lesson", step: "screen" } as const;

function getLessonScope(context: CreateLessonQuestionInput["context"]) {
  return context.kind === "answer" || context.kind === "step"
    ? LESSON_SCOPES[context.kind]
    : "lesson";
}

/** "Tutor Asked" for a new question, named by what it's about. */
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
    case "lesson":
      return {
        name: "Tutor Asked",
        properties: { lesson_id: subject.lesson.id, scope: getLessonScope(input.context) },
      };
    case "mock":
      return { name: "Tutor Asked", properties: { mock_id: subject.mockExamId, scope: "mock" } };
    case "plan":
      return { name: "Tutor Asked", properties: { goal_id: subject.goal.id, scope: "plan" } };
    default:
      return subject satisfies never;
  }
}
