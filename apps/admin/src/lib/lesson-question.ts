import { type LessonQuestionContextKind, type LessonQuestionStatus } from "@zoonk/db";

export function getAdminQuestionStatusVariant(status: LessonQuestionStatus) {
  if (status === "completed") {
    return "success" as const;
  }

  if (status === "failed") {
    return "destructive" as const;
  }

  return "secondary" as const;
}

export function getAdminQuestionContextLabel({
  contextKind,
  stepNumber,
}: {
  contextKind: LessonQuestionContextKind;
  stepNumber: number | null;
}) {
  if (contextKind === "answer") {
    return stepNumber ? `Learner answer · item ${stepNumber}` : "Learner answer";
  }

  if (contextKind === "step") {
    return stepNumber ? `Lesson content · item ${stepNumber}` : "Lesson content";
  }

  return "Lesson";
}
