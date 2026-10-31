import { type CourseFormat, type GoalKind } from "@zoonk/db";

export function getCourseGoalKind({
  format,
  hasExam,
  targetLanguage,
}: {
  format: CourseFormat;
  hasExam: boolean;
  targetLanguage: string | null;
}): GoalKind {
  if (hasExam || format === "exam") {
    return "exam";
  }

  return targetLanguage ? "language" : "learn";
}
