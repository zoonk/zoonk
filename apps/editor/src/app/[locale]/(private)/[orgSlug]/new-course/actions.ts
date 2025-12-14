"use server";

import { courseSlugExists, createCourse } from "@zoonk/core/courses";
import { cacheTagOrgCourses } from "@zoonk/utils/cache";
import { parseFormField } from "@zoonk/utils/form";
import { toSlug } from "@zoonk/utils/string";
import { revalidateTag } from "next/cache";
import { getExtracted, getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";

type CheckSlugParams = {
  orgSlug: string;
  language: string;
  slug: string;
};

export async function checkSlugExistsAction({
  orgSlug,
  language,
  slug,
}: CheckSlugParams): Promise<boolean> {
  if (!slug.trim()) {
    return false;
  }

  return courseSlugExists({ language, orgSlug, slug: toSlug(slug) });
}

export async function createCourseAction(formData: FormData) {
  const orgSlug = parseFormField(formData, "orgSlug");
  const title = parseFormField(formData, "title");
  const description = parseFormField(formData, "description");
  const language = parseFormField(formData, "language");
  const slug = parseFormField(formData, "slug");

  const locale = await getLocale();
  const t = await getExtracted();

  if (!(orgSlug && title && description && language && slug)) {
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

  revalidateTag(cacheTagOrgCourses({ orgSlug }), "max");

  redirect({
    href: `/${orgSlug}/c/${course.language}/${course.slug}`,
    locale,
  });
}
