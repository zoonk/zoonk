"use server";

import { deleteCourse, toggleCoursePublished } from "@zoonk/core/courses";
import { revalidateMainApp } from "@zoonk/core/revalidate";
import { cacheTagCourse, cacheTagOrgCourses } from "@zoonk/utils/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { getExtracted } from "next-intl/server";

export async function togglePublishAction(
  courseId: number,
  isPublished: boolean,
): Promise<{ error: string | null }> {
  const t = await getExtracted();

  const { error } = await toggleCoursePublished({
    courseId,
    isPublished,
  });

  if (error) {
    return { error: error.message ?? t("Failed to update course") };
  }

  const tag = cacheTagCourse({ courseId });

  after(async () => {
    await revalidateMainApp([tag]);
  });

  return { error: null };
}

export async function deleteCourseAction(
  courseId: number,
  orgSlug: string,
): Promise<{ error: string | null }> {
  const t = await getExtracted();

  const { error } = await deleteCourse({ courseId });

  if (error) {
    return { error: error.message ?? t("Failed to delete course") };
  }

  const courseTag = cacheTagCourse({ courseId });
  const orgCoursesTag = cacheTagOrgCourses({ orgSlug });

  after(async () => {
    await revalidateMainApp([courseTag, orgCoursesTag]);
  });

  redirect(`/${orgSlug}`);
}
