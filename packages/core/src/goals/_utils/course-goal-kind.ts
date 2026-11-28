import { type CourseFormat, type GoalKind } from "@zoonk/db";

export function getCourseGoalKind({
  format,
  targetLanguage,
}: {
  format: CourseFormat;
  targetLanguage: string | null;
}): GoalKind {
  if (format === "exam") {
    return "exam";
  }

  return targetLanguage ? "language" : "learn";
}
