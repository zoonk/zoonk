"use server";

import { revalidateMainApp } from "@zoonk/core/cache/revalidate";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { deleteLesson } from "@/data/lessons/delete-lesson";
import { toggleLessonPublished } from "@/data/lessons/publish-lesson";
import { getLessonCacheTags } from "@/lib/cache";
import { getErrorMessage } from "@/lib/error-messages";

export async function togglePublishAction(
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

  after(async () => {
    const tags = await getLessonCacheTags(lessonId);
    await revalidateMainApp(tags);
  });

  return { error: null };
}

export async function deleteLessonAction(
  lessonId: number,
  orgSlug: string,
): Promise<{ error: string | null }> {
  // Get cache tags before deleting (while relationships still exist)
  const tags = await getLessonCacheTags(lessonId);

  const { error } = await deleteLesson({ lessonId });

  if (error) {
    return { error: await getErrorMessage(error) };
  }

  after(async () => {
    await revalidateMainApp(tags);
  });

  redirect(`/${orgSlug}`);
}
