"use server";

import { getPathname } from "@/i18n/navigation";
import { resolveCourseEdition } from "@zoonk/core/courses/editions";
import { getCourse } from "@zoonk/core/courses/get-by-slug";
import { safeAsync } from "@zoonk/utils/error";
import { parseFormField } from "@zoonk/utils/form";
import { isValidLocale } from "@zoonk/utils/locale";
import { logError } from "@zoonk/utils/logger";
import { isUuid } from "@zoonk/utils/uuid";

export type CourseEditionActionState =
  | { status: "error" | "idle" | "unsupported" }
  | { href: string; status: "redirect" };

/**
 * Only an explicit form submission may resolve an unknown edition through AI.
 * Resolve the return route from the public source course before redirecting.
 */
export async function resolveCourseEditionAction(
  _previousState: CourseEditionActionState,
  formData: FormData,
): Promise<CourseEditionActionState> {
  const courseId = parseFormField(formData, "courseId");
  const brandSlug = parseFormField(formData, "brandSlug");
  const courseSlug = parseFormField(formData, "courseSlug");
  const locale = parseFormField(formData, "language");

  if (
    !courseId ||
    !isUuid(courseId) ||
    !brandSlug ||
    !courseSlug ||
    !locale ||
    !isValidLocale(locale)
  ) {
    return { status: "error" };
  }

  const { data: course, error: sourceError } = await safeAsync(() =>
    getCourse({ brandSlug, courseSlug }),
  );

  if (sourceError) {
    logError("Error loading source course for edition:", sourceError);
    return { status: "error" };
  }

  if (!course || course.id !== courseId || !course.organization) {
    return { status: "error" };
  }

  const { data: result, error } = await safeAsync(() =>
    resolveCourseEdition({ courseId, language: locale }),
  );

  if (error || !result) {
    logError("Error resolving course edition:", error);
    return { status: "error" };
  }

  if (result.kind === "unauthorized") {
    const next = getPathname({ href: `/b/${course.organization.slug}/c/${course.slug}`, locale });

    return {
      href: getPathname({
        forcePrefix: true,
        href: `/login?next=${encodeURIComponent(next)}`,
        locale,
      }),
      status: "redirect",
    };
  }

  if (result.kind === "course") {
    return {
      href: getPathname({ href: `/b/${course.organization.slug}/c/${result.course.slug}`, locale }),
      status: "redirect",
    };
  }

  if (result.kind === "generation") {
    return {
      href: getPathname({
        forcePrefix: true,
        href: `/generate/course/${result.coursePromptId}`,
        locale,
      }),
      status: "redirect",
    };
  }

  return { status: result.kind === "unsupported" ? "unsupported" : "error" };
}
