"use server";

import { revalidateMainApp } from "@zoonk/core/cache/revalidate";
import { cacheTagCourse, cacheTagOrgCourses } from "@zoonk/utils/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { deleteCourse } from "@/data/courses/delete-course";
import { toggleCoursePublished } from "@/data/courses/publish-course";
import { getErrorMessage } from "@/lib/error-messages";

export async function togglePublishAction(
  courseId: number,
  isPublished: boolean,
): Promise<{ error: string | null }> {
  const { error } = await toggleCoursePublished({
    courseId,
    isPublished,
  });

  if (error) {
    return { error: await getErrorMessage(error) };
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
  const { error } = await deleteCourse({ courseId });

  if (error) {
    return { error: await getErrorMessage(error) };
  }

  after(async () => {
    const courseTag = cacheTagCourse({ courseId });
    const orgCoursesTag = cacheTagOrgCourses({ orgSlug });

    await revalidateMainApp([courseTag, orgCoursesTag]);
  });

  redirect(`/${orgSlug}`);
}
