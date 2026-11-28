import { type CourseFormat } from "@zoonk/db";
import { getQuickTestMinutes } from "../language/level-test/level-test-contract";
import { getCourseGoalKind } from "./_utils/course-goal-kind";

export function getCourseQuickTestMinutes(course: {
  format: CourseFormat;
  targetLanguage: string | null;
}): number {
  return getQuickTestMinutes(getCourseGoalKind(course));
}
