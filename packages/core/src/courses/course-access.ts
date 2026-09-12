import { type Course, type CourseGetPayload, type prisma } from "@zoonk/db";
import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { CURRENT_CURRICULUM_VERSION } from "./learning-plan-contract";

type CourseWhere = NonNullable<Parameters<typeof prisma.course.findFirst>[0]>["where"];

/** Trusted internal query predicate; public callers derive this identity from the session. */
export function getReadableCourseWhere(userId: string | null): CourseWhere {
  return {
    OR: [
      { organization: { kind: "brand" }, userId: null },
      ...(userId ? [{ organizationId: null, userId }] : []),
    ],
    isPublished: true,
  };
}

export function getCourseBrandSlug(course: CourseGetPayload<{ include: { organization: true } }>) {
  return course.userId ? "me" : (course.organization?.slug ?? "");
}

type CourseLearningCapability = Pick<Course, "curriculumVersion" | "organizationId" | "userId"> & {
  organization: { slug: string } | null;
};

/** Generation eligibility after the caller has established read or write access. */
export function isGeneratedCourse(course: CourseLearningCapability) {
  return course.userId === null
    ? course.organization?.slug === AI_ORG_SLUG
    : course.organizationId === null;
}

/** Authored legacy material has no level structure to personalize or replace. */
export function supportsCourseLearningPlan(course: CourseLearningCapability) {
  return isGeneratedCourse(course) || course.curriculumVersion >= CURRENT_CURRICULUM_VERSION;
}
