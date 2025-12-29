"use server";

import { revalidateMainApp } from "@zoonk/core/cache/revalidate";
import {
  cacheTagChapter,
  cacheTagCourse,
  cacheTagLesson,
} from "@zoonk/utils/cache";
import { after } from "next/server";
import { lessonSlugExists } from "@/data/lessons/lesson-slug";
import { updateLesson } from "@/data/lessons/update-lesson";
import { getErrorMessage } from "@/lib/error-messages";

export async function checkLessonSlugExists(params: {
  language: string;
  orgSlug: string;
  slug: string;
}): Promise<boolean> {
  return lessonSlugExists(params);
}

export async function updateLessonTitleAction(
  slugs: { lessonSlug: string; chapterSlug: string; courseSlug: string },
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
    await revalidateMainApp([
      cacheTagLesson({ lessonSlug: slugs.lessonSlug }),
      cacheTagChapter({ chapterSlug: slugs.chapterSlug }),
      cacheTagCourse({ courseSlug: slugs.courseSlug }),
    ]);
  });

  return { error: null };
}

export async function updateLessonDescriptionAction(
  slugs: { lessonSlug: string; chapterSlug: string; courseSlug: string },
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
    await revalidateMainApp([
      cacheTagLesson({ lessonSlug: slugs.lessonSlug }),
      cacheTagChapter({ chapterSlug: slugs.chapterSlug }),
      cacheTagCourse({ courseSlug: slugs.courseSlug }),
    ]);
  });

  return { error: null };
}

export async function updateLessonSlugAction(
  slugs: { lessonSlug: string; chapterSlug: string; courseSlug: string },
  lessonId: number,
  data: { slug: string },
): Promise<{ error: string | null; newSlug?: string }> {
  const { data: lesson, error } = await updateLesson({
    lessonId,
    slug: data.slug,
  });

  if (error) {
    return { error: await getErrorMessage(error) };
  }

  after(async () => {
    await revalidateMainApp([
      cacheTagLesson({ lessonSlug: slugs.lessonSlug }),
      cacheTagLesson({ lessonSlug: lesson.slug }),
      cacheTagChapter({ chapterSlug: slugs.chapterSlug }),
      cacheTagCourse({ courseSlug: slugs.courseSlug }),
    ]);
  });

  return { error: null, newSlug: lesson.slug };
}
