"use server";

import { lessonSlugExists } from "@/data/lessons/lesson-slug";
import { updateLesson } from "@/data/lessons/update-lesson";
import { getErrorMessage } from "@/lib/error-messages";
import { revalidatePath } from "next/cache";

export async function checkLessonSlugExists(params: {
  chapterId?: number;
  slug: string;
}): Promise<boolean> {
  if (!params.chapterId) {
    return false;
  }

  return lessonSlugExists({ chapterId: params.chapterId, slug: params.slug });
}

export async function updateLessonTitleAction(
  slugs: { chapterSlug: string; courseSlug: string; orgSlug: string },
  lessonId: number,
  data: { title: string },
): Promise<{ error: string | null }> {
  const { chapterSlug, courseSlug, orgSlug } = slugs;

  const { error } = await updateLesson({
    lessonId,
    title: data.title,
  });

  if (error) {
    return { error: await getErrorMessage(error) };
  }

  revalidatePath(`/${orgSlug}/c/${courseSlug}/ch/${chapterSlug}`);
  return { error: null };
}

export async function updateLessonDescriptionAction(
  slugs: { chapterSlug: string; courseSlug: string; orgSlug: string },
  lessonId: number,
  data: { description: string },
): Promise<{ error: string | null }> {
  const { chapterSlug, courseSlug, orgSlug } = slugs;

  const { error } = await updateLesson({
    description: data.description,
    lessonId,
  });

  if (error) {
    return { error: await getErrorMessage(error) };
  }

  revalidatePath(`/${orgSlug}/c/${courseSlug}/ch/${chapterSlug}`);
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

  return { error: null, newSlug: lesson.slug };
}
