import { type ServiceTier } from "@zoonk/ai/provider-options";
import { writeGoalCourseSearchTerms } from "@zoonk/core/library/curriculum/find-or-create-course";
import {
  getGoalCourseFormat,
  setGoalPrimaryCourse,
} from "@zoonk/core/library/curriculum/goal-primary-course";
import { findGoalCourse, findGoalProductCourse } from "@zoonk/core/library/products/goal-courses";
import { type GoalKind } from "@zoonk/db";

type CourseInput = Parameters<typeof findGoalCourse>[0];

export async function writeGoalCourseSearchTermsStep(
  input: Pick<CourseInput, "analytics" | "scope" | "title"> & { serviceTier?: ServiceTier },
) {
  "use step";
  return writeGoalCourseSearchTerms(input);
}

export async function findGoalProductCourseStep(
  input: Parameters<typeof findGoalProductCourse>[0],
) {
  "use step";
  const result = await findGoalProductCourse(input);
  return result?.course.id ?? null;
}

export async function findGoalCourseStep({
  kind,
  ...input
}: Omit<CourseInput, "format" | "searchTerms"> & { kind: GoalKind; searchTerms: string[] }) {
  "use step";

  const format = getGoalCourseFormat({ kind, ownerId: input.scope.ownerId });
  const { course } = await findGoalCourse({ ...input, format });
  return course.id;
}

export async function setGoalPrimaryCourseStep(input: Parameters<typeof setGoalPrimaryCourse>[0]) {
  "use step";
  return setGoalPrimaryCourse(input);
}
