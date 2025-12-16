"use server";

import { createCourse } from "@zoonk/core/courses";
import { revalidateMainApp } from "@zoonk/core/revalidate";
import { cacheTagOrgCourses } from "@zoonk/utils/cache";
import { toSlug } from "@zoonk/utils/string";
import { revalidateTag } from "next/cache";
import { after } from "next/server";
import { getExtracted, getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import type { CourseFormData } from "./use-course-form";

export async function createCourseAction(
  formData: CourseFormData,
  orgSlug: string,
) {
  const title = formData.title.trim();
  const description = formData.description.trim();
  const language = formData.language;
  const slug = formData.slug.trim();

  const locale = await getLocale();
  const t = await getExtracted();

  if (!(title && description && language && slug)) {
    return { error: t("All fields are required") };
  }

  const { data: course, error } = await createCourse({
    description,
    language,
    orgSlug,
    slug: toSlug(slug),
    title,
  });

  if (error || !course) {
    return { error: error?.message ?? t("Failed to create course") };
  }

  const tag = cacheTagOrgCourses({ orgSlug });

  revalidateTag(tag, "max");

  after(async () => {
    await revalidateMainApp([tag]);
  });

  redirect({
    href: `/${orgSlug}/c/${course.language}/${course.slug}`,
    locale,
  });
}
