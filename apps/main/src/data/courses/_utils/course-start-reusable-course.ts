import "server-only";
import { getCourseSlugForTitle } from "@zoonk/core/courses/slug";
import {
  type Course,
  type CourseStartRequest,
  getAiGenerationCourseWhere,
  prisma,
} from "@zoonk/db";
import { type AiCourseHref, getAiCourseHref } from "../course-href";

export type CourseStartRequestWithCourse = CourseStartRequest & { course: Course | null };

/**
 * Looks for the reusable AI course that would be produced from this canonical
 * title. This mirrors the workflow slug rule so the start flow can skip
 * generation only when the exact generated course identity already exists.
 */
async function findCompletedReusableCourse({
  language,
  title,
}: {
  language: string;
  title: string;
}): Promise<Course | null> {
  const slug = getCourseSlugForTitle({ language, title });

  return prisma.course.findFirst({
    where: getAiGenerationCourseWhere({
      generationStatus: "completed",
      isPublished: true,
      language,
      slug,
    }),
  });
}

/**
 * Keeps the request row aligned with the reusable course it resolved to. The
 * request remains the audit/cache record for the learner prompt, but it no
 * longer needs a workflow run once a completed course can satisfy it.
 */
async function linkStartRequestToCourse({
  course,
  request,
}: {
  course: Course;
  request: CourseStartRequest;
}): Promise<void> {
  if (
    request.courseId === course.id &&
    request.generationRunId === null &&
    request.generationStatus === "completed"
  ) {
    return;
  }

  await prisma.courseStartRequest.update({
    data: { courseId: course.id, generationRunId: null, generationStatus: "completed" },
    where: { id: request.id },
  });
}

/**
 * Treats an already-linked course as reusable only when the public route can
 * serve it immediately. Other generation states still need the generate page.
 */
function getLinkedCompletedCourse(request: CourseStartRequestWithCourse): Course | null {
  if (request.course?.generationStatus === "completed" && request.course.isPublished) {
    return request.course;
  }

  return null;
}

/**
 * Resolves the completed course that can satisfy this start request without
 * generation. The relation wins when present; otherwise the canonical title is
 * converted into the same locale-aware slug the workflow would create.
 */
async function getReusableCourseForRequest(
  request: CourseStartRequestWithCourse,
): Promise<Course | null> {
  const linkedCourse = getLinkedCompletedCourse(request);

  if (linkedCourse) {
    return linkedCourse;
  }

  if (!request.canonicalTitle) {
    return null;
  }

  return findCompletedReusableCourse({ language: request.language, title: request.canonicalTitle });
}

/**
 * Returns the public course URL for requests that can be satisfied by an
 * existing completed course, while updating the request row so future reads
 * know which course fulfilled the learner prompt.
 */
export async function getReusableCourseHrefForStartRequest(
  request: CourseStartRequestWithCourse,
): Promise<AiCourseHref | null> {
  const reusableCourse = await getReusableCourseForRequest(request);

  if (!reusableCourse) {
    return null;
  }

  await linkStartRequestToCourse({ course: reusableCourse, request });

  return getAiCourseHref(reusableCourse);
}
