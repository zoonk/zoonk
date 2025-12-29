"use server";

import { revalidateMainApp } from "@zoonk/core/cache/revalidate";
import { cacheTagChapter, cacheTagCourse } from "@zoonk/utils/cache";
import { after } from "next/server";
import { getExtracted } from "next-intl/server";
import { chapterSlugExists } from "@/data/chapters/chapter-slug";
import { updateChapter } from "@/data/chapters/update-chapter";
import { createLesson } from "@/data/lessons/create-lesson";
import { getErrorMessage } from "@/lib/error-messages";

export async function checkChapterSlugExists(params: {
  language: string;
  orgSlug: string;
  slug: string;
}): Promise<boolean> {
  return chapterSlugExists(params);
}

export async function updateChapterTitleAction(
  chapterSlug: string,
  courseSlug: string,
  chapterId: number,
  data: { title: string },
): Promise<{ error: string | null }> {
  const { error } = await updateChapter({
    chapterId,
    title: data.title,
  });

  if (error) {
    return { error: await getErrorMessage(error) };
  }

  after(async () => {
    await revalidateMainApp([
      cacheTagChapter({ chapterSlug }),
      cacheTagCourse({ courseSlug }),
    ]);
  });

  return { error: null };
}

export async function updateChapterDescriptionAction(
  chapterSlug: string,
  courseSlug: string,
  chapterId: number,
  data: { description: string },
): Promise<{ error: string | null }> {
  const { error } = await updateChapter({
    chapterId,
    description: data.description,
  });

  if (error) {
    return { error: await getErrorMessage(error) };
  }

  after(async () => {
    await revalidateMainApp([
      cacheTagChapter({ chapterSlug }),
      cacheTagCourse({ courseSlug }),
    ]);
  });

  return { error: null };
}

export async function updateChapterSlugAction(
  currentSlug: string,
  courseSlug: string,
  chapterId: number,
  data: { slug: string },
): Promise<{ error: string | null; newSlug?: string }> {
  const { data: chapter, error } = await updateChapter({
    chapterId,
    slug: data.slug,
  });

  if (error) {
    return { error: await getErrorMessage(error) };
  }

  after(async () => {
    await revalidateMainApp([
      cacheTagChapter({ chapterSlug: currentSlug }),
      cacheTagChapter({ chapterSlug: chapter.slug }),
      cacheTagCourse({ courseSlug }),
    ]);
  });

  return { error: null, newSlug: chapter.slug };
}

export async function createLessonAction(
  chapterSlug: string,
  courseSlug: string,
  chapterId: number,
  position: number,
): Promise<{ error: string | null; slug?: string }> {
  const t = await getExtracted();
  const slug = `lesson-${Date.now()}`;
  const title = t("Untitled lesson");
  const description = t("Add a description…");

  const { data, error } = await createLesson({
    chapterId,
    description,
    position,
    slug,
    title,
  });

  if (error) {
    return { error: await getErrorMessage(error) };
  }

  after(async () => {
    await revalidateMainApp([
      cacheTagChapter({ chapterSlug }),
      cacheTagCourse({ courseSlug }),
    ]);
  });

  return { error: null, slug: data.slug };
}
