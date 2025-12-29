"use server";

import { revalidateMainApp } from "@zoonk/core/cache/revalidate";
import {
  cacheTagChapter,
  cacheTagCourse,
  cacheTagLesson,
} from "@zoonk/utils/cache";
import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { deleteLesson } from "@/data/lessons/delete-lesson";
import { toggleLessonPublished } from "@/data/lessons/publish-lesson";
import { getErrorMessage } from "@/lib/error-messages";

export async function togglePublishAction(
  slugs: { lessonSlug: string; chapterSlug: string; courseSlug: string },
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
    await revalidateMainApp([
      cacheTagLesson({ lessonSlug: slugs.lessonSlug }),
      cacheTagChapter({ chapterSlug: slugs.chapterSlug }),
      cacheTagCourse({ courseSlug: slugs.courseSlug }),
    ]);
  });

  return { error: null };
}

export async function deleteLessonAction(
  slugs: { lessonSlug: string; chapterSlug: string; courseSlug: string },
  lessonId: number,
  chapterUrl: Route,
): Promise<{ error: string | null }> {
  const { error } = await deleteLesson({ lessonId });

  if (error) {
    return { error: await getErrorMessage(error) };
  }

  after(async () => {
    await revalidateMainApp([
      cacheTagLesson({ lessonSlug: slugs.lessonSlug }),
      cacheTagChapter({ chapterSlug: slugs.chapterSlug }),
      cacheTagCourse({ courseSlug: slugs.courseSlug }),
    ]);
  });

  revalidatePath(chapterUrl);
  redirect(chapterUrl);
}
