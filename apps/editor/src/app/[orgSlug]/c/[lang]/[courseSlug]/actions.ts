"use server";

import { revalidateMainApp } from "@zoonk/core/cache/revalidate";
import { cacheTagCourse } from "@zoonk/utils/cache";
import { after } from "next/server";
import { updateCourse } from "@/data/courses/update-course";
import { getErrorMessage } from "@/lib/error-messages";

export async function updateCourseAction(
  courseId: number,
  data: { title?: string; description?: string },
): Promise<{ error: string | null }> {
  const { error } = await updateCourse({
    courseId,
    ...data,
  });

  if (error) {
    return { error: await getErrorMessage(error) };
  }

  after(async () => {
    await revalidateMainApp([cacheTagCourse({ courseId })]);
  });

  return { error: null };
}
