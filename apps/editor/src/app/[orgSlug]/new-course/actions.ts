"use server";

import { courseSlugExists } from "@/data/courses/course-slug";
import { createCourse } from "@/data/courses/create-course";
import { getErrorMessage } from "@/lib/error-messages";
import { revalidateMainApp } from "@zoonk/core/cache/revalidate";
import { cacheTagOrgCourses } from "@zoonk/utils/cache";
import { toSlug } from "@zoonk/utils/string";
import { getExtracted } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { type CourseFormData } from "./use-course-form";

export async function checkSlugExists({
  language,
  orgSlug,
  slug,
}: {
  language: string;
  orgSlug: string;
  slug: string;
}): Promise<boolean> {
  if (!slug.trim()) {
    return false;
  }

  return courseSlugExists({ language, orgSlug, slug: toSlug(slug) });
}

export async function createCourseAction(formData: CourseFormData, orgSlug: string) {
  const title = formData.title.trim();
  const description = formData.description.trim();
  const language = formData.language;
  const slug = formData.slug.trim();

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
    return { error: await getErrorMessage(error) };
  }

  after(async () => {
    await revalidateMainApp([cacheTagOrgCourses({ orgSlug })]);
  });

  revalidatePath(`/${orgSlug}`);
  redirect(`/${orgSlug}/c/${course.language}/${course.slug}`);
}
