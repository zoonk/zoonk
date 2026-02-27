"use server";

import { deleteCourse } from "@/data/courses/delete-course";
import { toggleCoursePublished } from "@/data/courses/publish-course";
import { getErrorMessage } from "@/lib/error-messages";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function togglePublishAction(
  params: {
    courseId: number;
    courseUrl: string;
  },
  isPublished: boolean,
): Promise<{ error: string | null }> {
  const { courseId, courseUrl } = params;

  const { error } = await toggleCoursePublished({
    courseId,
    isPublished,
  });

  if (error) {
    return { error: await getErrorMessage(error) };
  }

  revalidatePath(courseUrl);

  return { error: null };
}

export async function deleteCourseAction(
  orgSlug: string,
  courseId: number,
): Promise<{ error: string | null }> {
  const { error } = await deleteCourse({ courseId });

  if (error) {
    return { error: await getErrorMessage(error) };
  }

  revalidatePath(`/${orgSlug}`);
  redirect(`/${orgSlug}`);
}
