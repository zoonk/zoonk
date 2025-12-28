"use server";

import { revalidateMainApp } from "@zoonk/core/cache/revalidate";
import { cacheTagCourse } from "@zoonk/utils/cache";
import { after } from "next/server";
import { updateCourse } from "@/data/courses/update-course";
import { getErrorMessage } from "@/lib/error-messages";

export async function updateCourseTitleAction(
  courseSlug: string,
  courseId: number,
  data: { title: string },
): Promise<{ error: string | null }> {
  const { error } = await updateCourse({
    courseId,
    title: data.title,
  });

  if (error) {
    return { error: await getErrorMessage(error) };
  }

  after(async () => {
    await revalidateMainApp([cacheTagCourse({ courseSlug })]);
  });

  return { error: null };
}

export async function updateCourseDescriptionAction(
  courseSlug: string,
  courseId: number,
  data: { description: string },
): Promise<{ error: string | null }> {
  const { error } = await updateCourse({
    courseId,
    description: data.description,
  });

  if (error) {
    return { error: await getErrorMessage(error) };
  }

  after(async () => {
    await revalidateMainApp([cacheTagCourse({ courseSlug })]);
  });

  return { error: null };
}
