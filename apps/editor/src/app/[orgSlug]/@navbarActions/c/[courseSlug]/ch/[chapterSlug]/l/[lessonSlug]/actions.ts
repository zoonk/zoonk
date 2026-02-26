"use server";

import { deleteLesson } from "@/data/lessons/delete-lesson";
import { toggleLessonPublished } from "@/data/lessons/publish-lesson";
import { getErrorMessage } from "@/lib/error-messages";
import { type Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function togglePublishAction(
  lessonUrl: string,
  lessonId: number,
  isPublished: boolean,
): Promise<{ error: string | null }> {
  const { error } = await toggleLessonPublished({
    isPublished,
    lessonId,
  });

  if (error) {
    return { error: await getErrorMessage(error) };
  }

  revalidatePath(lessonUrl);

  return { error: null };
}

export async function deleteLessonAction(
  lessonId: number,
  chapterUrl: Route,
): Promise<{ error: string | null }> {
  const { error } = await deleteLesson({ lessonId });

  if (error) {
    return { error: await getErrorMessage(error) };
  }

  revalidatePath(chapterUrl);
  redirect(chapterUrl);
}
