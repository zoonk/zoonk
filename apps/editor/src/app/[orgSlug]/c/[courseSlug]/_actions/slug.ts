"use server";

import { courseSlugExists } from "@/data/courses/course-slug";
import { updateCourse } from "@/data/courses/update-course";
import { getErrorMessage } from "@/lib/error-messages";
import { AI_ORG_SLUG } from "@zoonk/utils/constants";
import { ensureLocaleSuffix, toSlug } from "@zoonk/utils/string";

export async function checkCourseSlugExists(params: {
  language: string;
  orgSlug: string;
  slug: string;
}): Promise<boolean> {
  const isAiOrg = params.orgSlug === AI_ORG_SLUG;

  const normalizedSlug = isAiOrg
    ? ensureLocaleSuffix(toSlug(params.slug), params.language)
    : toSlug(params.slug);

  return courseSlugExists({ orgSlug: params.orgSlug, slug: normalizedSlug });
}

export async function updateCourseSlugAction(
  currentSlug: string,
  language: string,
  orgSlug: string,
  courseId: number,
  data: { slug: string },
): Promise<{ error: string | null; newSlug?: string }> {
  const isAiOrg = orgSlug === AI_ORG_SLUG;
  const slugValue = isAiOrg ? ensureLocaleSuffix(data.slug, language) : data.slug;

  const { data: course, error } = await updateCourse({
    courseId,
    slug: slugValue,
  });

  if (error) {
    return { error: await getErrorMessage(error) };
  }

  return { error: null, newSlug: course.slug };
}
