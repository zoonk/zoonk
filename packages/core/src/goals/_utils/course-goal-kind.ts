import { type CourseFormat, type GoalKind } from "@zoonk/db";

/**
 * The kind of goal a course start makes, which the course's estimate plans as too: an exam goal
 * when the course links to a stored exam, or is an exam course whose exam isn't stored yet (a
 * course from before the Library, whose notice research reads); a language goal for a language
 * course; a learn goal otherwise.
 */
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
