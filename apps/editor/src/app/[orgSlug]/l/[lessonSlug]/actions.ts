"use server";

import { revalidateMainApp } from "@zoonk/core/cache/revalidate";
import { cacheTagLesson } from "@zoonk/utils/cache";
import { after } from "next/server";
import { updateLesson } from "@/data/lessons/update-lesson";
import { getErrorMessage } from "@/lib/error-messages";

export async function updateLessonTitleAction(
  lessonId: number,
  data: { title: string },
): Promise<{ error: string | null }> {
  const { error } = await updateLesson({
    lessonId,
    title: data.title,
  });

  if (error) {
    return { error: await getErrorMessage(error) };
  }

  after(async () => {
    await revalidateMainApp([cacheTagLesson({ lessonId })]);
  });

  return { error: null };
}

export async function updateLessonDescriptionAction(
  lessonId: number,
  data: { description: string },
): Promise<{ error: string | null }> {
  const { error } = await updateLesson({
    description: data.description,
    lessonId,
  });

  if (error) {
    return { error: await getErrorMessage(error) };
  }

  after(async () => {
    await revalidateMainApp([cacheTagLesson({ lessonId })]);
  });

  return { error: null };
}
