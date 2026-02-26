"use server";

import { chapterSlugExists } from "@/data/chapters/chapter-slug";
import { updateChapter } from "@/data/chapters/update-chapter";
import { createLesson } from "@/data/lessons/create-lesson";
import { exportLessons } from "@/data/lessons/export-lessons";
import { importLessons } from "@/data/lessons/import-lessons";
import { reorderLessons } from "@/data/lessons/reorder-lessons";
import { getErrorMessage } from "@/lib/error-messages";
import { isImportMode } from "@/lib/import-mode";
import { getExtracted } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function checkChapterSlugExists(params: {
  courseId?: number;
  language: string;
  orgSlug: string;
  slug: string;
}): Promise<boolean> {
  if (!params.courseId) {
    return false;
  }
  return chapterSlugExists({ courseId: params.courseId, slug: params.slug });
}

export async function updateChapterTitleAction(
  slugs: { courseSlug: string; orgSlug: string },
  chapterId: number,
  data: { title: string },
): Promise<{ error: string | null }> {
  const { courseSlug, orgSlug } = slugs;

  const { error } = await updateChapter({
    chapterId,
    title: data.title,
  });

  if (error) {
    return { error: await getErrorMessage(error) };
  }

  revalidatePath(`/${orgSlug}/c/${courseSlug}`);
  return { error: null };
}

export async function updateChapterDescriptionAction(
  slugs: { courseSlug: string; orgSlug: string },
  chapterId: number,
  data: { description: string },
): Promise<{ error: string | null }> {
  const { courseSlug, orgSlug } = slugs;

  const { error } = await updateChapter({
    chapterId,
    description: data.description,
  });

  if (error) {
    return { error: await getErrorMessage(error) };
  }

  revalidatePath(`/${orgSlug}/c/${courseSlug}`);
  return { error: null };
}

export async function updateChapterSlugAction(
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

  return { error: null, newSlug: chapter.slug };
}

async function createLessonAction(
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

  return { error: null, slug: data.slug };
}

async function importLessonsAction(
  chapterId: number,
  formData: FormData,
): Promise<{ error: string | null }> {
  const file = formData.get("file");
  const modeValue = formData.get("mode");
  const mode = isImportMode(modeValue) ? modeValue : "merge";

  if (!(file && file instanceof File)) {
    const t = await getExtracted();
    return { error: t("No file provided") };
  }

  const { error } = await importLessons({
    chapterId,
    file,
    mode,
  });

  if (error) {
    return { error: await getErrorMessage(error) };
  }

  return { error: null };
}

export async function exportLessonsAction(chapterId: number): Promise<{
  data: object | null;
  error: Error | null;
}> {
  const { data, error } = await exportLessons({ chapterId });

  if (error) {
    return { data: null, error };
  }

  return { data, error: null };
}

type LessonRouteParams = {
  chapterId: number;
  chapterSlug: string;
  courseSlug: string;
  orgSlug: string;
};

export async function insertLessonAction(
  params: LessonRouteParams,
  position: number,
): Promise<void> {
  const { chapterId, chapterSlug, courseSlug, orgSlug } = params;
  const { slug, error } = await createLessonAction(chapterId, position);

  if (error) {
    throw new Error(error);
  }

  if (slug) {
    revalidatePath(`/${orgSlug}/c/${courseSlug}/ch/${chapterSlug}`);
    redirect(`/${orgSlug}/c/${courseSlug}/ch/${chapterSlug}/l/${slug}`);
  }
}

export async function handleImportLessonsAction(
  params: LessonRouteParams,
  formData: FormData,
): Promise<{ error: string | null }> {
  const { chapterId, chapterSlug, courseSlug, orgSlug } = params;
  const { error } = await importLessonsAction(chapterId, formData);

  if (error) {
    return { error };
  }

  revalidatePath(`/${orgSlug}/c/${courseSlug}/ch/${chapterSlug}`);
  return { error: null };
}

export async function reorderLessonsAction(
  params: LessonRouteParams,
  lessons: { id: number; position: number }[],
): Promise<{ error: string | null }> {
  const { chapterId, chapterSlug, courseSlug, orgSlug } = params;

  const { error } = await reorderLessons({
    chapterId,
    lessons: lessons.map((lesson) => ({ lessonId: lesson.id, position: lesson.position })),
  });

  if (error) {
    return { error: await getErrorMessage(error) };
  }

  revalidatePath(`/${orgSlug}/c/${courseSlug}/ch/${chapterSlug}`);
  return { error: null };
}
