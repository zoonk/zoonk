import { type CourseLevel } from "../curriculum/_utils/course-levels";

/**
 * Overview and beginner learners meet the subject for the first time, so their lessons show more and
 * ask less. Exams and a learner's own class material set their own rules instead.
 */
export function readsNoviceRules({
  exams,
  level,
  material,
}: {
  exams?: readonly unknown[];
  level: CourseLevel;
  material?: string;
}): boolean {
  return (level === "overview" || level === "beginner") && !exams?.length && !material;
}
