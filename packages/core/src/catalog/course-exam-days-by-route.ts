import "server-only";
import { getCourseRouteWhere, prisma } from "@zoonk/db";
import { cacheTag } from "next/cache";
import { getCourseRouteCacheTag } from "../cache/tags";
import { decodeRouteParam } from "../navigation/decode-route-param";
import { getCourseExamDays } from "./course-exam-days";
import { type CourseExamDays } from "./course-exam-days-contract";

/** The id of the published brand course a catalog route names, kept until the route changes. */
async function getCachedRouteCourseId(params: {
  brandSlug: string;
  courseSlug: string;
}): Promise<string | null> {
  "use cache";
  cacheTag(getCourseRouteCacheTag(params));

  const course = await prisma.course.findFirst({
    select: { id: true },
    where: getCourseRouteWhere(params),
  });

  return course?.id ?? null;
}

/**
 * `getCourseExamDays` for a page that names the exam course by its catalog route
 * (`/b/{brandSlug}/c/{courseSlug}`) instead of its id, such as the home page's example exam. Null
 * when no public exam course has that route or its next sitting is unknown.
 */
export async function getCourseExamDaysByRoute(params: {
  brandSlug: string;
  courseSlug: string;
}): Promise<CourseExamDays | null> {
  const courseId = await getCachedRouteCourseId({
    brandSlug: decodeRouteParam(params.brandSlug),
    courseSlug: decodeRouteParam(params.courseSlug),
  });

  return courseId ? getCourseExamDays(courseId) : null;
}
