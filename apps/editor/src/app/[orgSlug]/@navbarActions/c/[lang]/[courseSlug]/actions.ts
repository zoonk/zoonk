"use server";

import { revalidateMainApp } from "@zoonk/core/cache/revalidate";
import { cacheTagCourse, cacheTagOrgCourses } from "@zoonk/utils/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { deleteCourse } from "@/data/courses/delete-course";
import { toggleCoursePublished } from "@/data/courses/publish-course";
import { getErrorMessage } from "@/lib/error-messages";

export async function togglePublishAction(
  courseSlug: string,
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
    await revalidateMainApp([cacheTagCourse({ courseSlug })]);
  });

  return { error: null };
}

export async function deleteCourseAction(
  courseSlug: string,
  orgSlug: string,
  courseId: number,
): Promise<{ error: string | null }> {
  const { error } = await deleteCourse({ courseId });

  if (error) {
    return { error: await getErrorMessage(error) };
  }

  after(async () => {
    const courseTag = cacheTagCourse({ courseSlug });
    const orgCoursesTag = cacheTagOrgCourses({ orgSlug });

    await revalidateMainApp([courseTag, orgCoursesTag]);
  });

  redirect(`/${orgSlug}`);
}
