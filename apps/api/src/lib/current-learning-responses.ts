import { type listCurrentUserCoursesPage } from "@zoonk/core/courses/list-current-user";
import { toOrganizationSummary } from "./catalog-responses";

type CurrentUserCourse = NonNullable<
  Awaited<ReturnType<typeof listCurrentUserCoursesPage>>
>["courses"][number];

/**
 * Serializes one learner-owned course into the compact library resource. A
 * personal course can legitimately have no organization, so that relationship
 * remains nullable instead of inventing a synthetic brand.
 */
export function toCurrentUserCourse(course: CurrentUserCourse) {
  return {
    description: course.description,
    id: course.id,
    imageUrl: course.imageUrl,
    language: course.language,
    organization: course.organization ? toOrganizationSummary(course.organization) : null,
    slug: course.slug,
    title: course.title,
  };
}
