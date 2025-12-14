"use server";

import { createCourse } from "@zoonk/core/courses";
import { getOrganizationBySlug } from "@zoonk/core/organizations";
import { cacheTagOrgCourses } from "@zoonk/utils/cache";
import { parseFormField } from "@zoonk/utils/form";
import { revalidateTag } from "next/cache";
import { redirect } from "@/i18n/navigation";

export async function createCourseAction(formData: FormData) {
  const orgSlug = parseFormField(formData, "orgSlug");
  const title = parseFormField(formData, "title");
  const description = parseFormField(formData, "description");
  const language = parseFormField(formData, "language");
  const slug = parseFormField(formData, "slug");
  const locale = parseFormField(formData, "locale");

  if (!(orgSlug && title && description && language && slug && locale)) {
    return { error: "All fields are required" };
  }

  const { data: org } = await getOrganizationBySlug(orgSlug);

  if (!org) {
    return { error: "Organization not found" };
  }

  const { data: course, error } = await createCourse({
    description,
    language,
    organizationId: org.id,
    slug,
    title,
  });

  if (error || !course) {
    return { error: error?.message ?? "Failed to create course" };
  }

  revalidateTag(cacheTagOrgCourses({ orgSlug }), "max");

  redirect({
    href: `/${orgSlug}/c/${course.language}/${course.slug}`,
    locale,
  });
}
