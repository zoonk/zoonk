"use server";

import { updateCourse } from "@/data/courses/update-course";
import { getErrorMessage } from "@/lib/error-messages";

export async function updateCourseTitleAction(
  courseId: string,
  data: { title: string },
): Promise<{ error: string | null }> {
  const { error } = await updateCourse({
    courseId,
    title: data.title,
  });

  if (error) {
    return { error: await getErrorMessage(error) };
  }

  return { error: null };
}

export async function updateCourseDescriptionAction(
  courseId: string,
  data: { description: string },
): Promise<{ error: string | null }> {
  const { error } = await updateCourse({
    courseId,
    description: data.description,
  });

  if (error) {
    return { error: await getErrorMessage(error) };
  }

  return { error: null };
}
