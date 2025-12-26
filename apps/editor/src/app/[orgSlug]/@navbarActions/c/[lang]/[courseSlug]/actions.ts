"use server";

import { revalidateMainApp } from "@zoonk/core/cache/revalidate";
import { deleteCourse } from "@zoonk/core/courses/delete";
import { toggleCoursePublished } from "@zoonk/core/courses/publish";
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

  after(async () => {
    await revalidateMainApp([cacheTagCourse({ courseId })]);
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

  after(async () => {
    const courseTag = cacheTagCourse({ courseId });
    const orgCoursesTag = cacheTagOrgCourses({ orgSlug });

    await revalidateMainApp([courseTag, orgCoursesTag]);
  });

  redirect(`/${orgSlug}`);
}
