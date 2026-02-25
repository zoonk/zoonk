"use server";

import { createChapter } from "@/data/chapters/create-chapter";
import { exportChapters } from "@/data/chapters/export-chapters";
import { importChapters } from "@/data/chapters/import-chapters";
import { reorderChapters } from "@/data/chapters/reorder-chapters";
import { getErrorMessage } from "@/lib/error-messages";
import { isImportMode } from "@/lib/import-mode";
import { revalidateMainApp } from "@zoonk/core/cache/revalidate";
import { cacheTagCourse } from "@zoonk/utils/cache";
import { getExtracted } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";

async function createChapterAction(
  courseSlug: string,
  courseId: number,
  position: number,
): Promise<{ error: string | null; slug?: string }> {
  const t = await getExtracted();
  const slug = `chapter-${Date.now()}`;
  const title = t("Untitled chapter");
  const description = t("Add a description…");

  const { data, error } = await createChapter({
    courseId,
    description,
    position,
    slug,
    title,
  });

  if (error) {
    return { error: await getErrorMessage(error) };
  }

  after(async () => {
    await revalidateMainApp([cacheTagCourse({ courseSlug })]);
  });

  return { error: null, slug: data.slug };
}

async function importChaptersAction(
  courseSlug: string,
  courseId: number,
  formData: FormData,
): Promise<{ error: string | null }> {
  const file = formData.get("file");
  const modeValue = formData.get("mode");
  const mode = isImportMode(modeValue) ? modeValue : "merge";

  if (!(file && file instanceof File)) {
    const t = await getExtracted();
    return { error: t("No file provided") };
  }

  const { error } = await importChapters({
    courseId,
    file,
    mode,
  });

  if (error) {
    return { error: await getErrorMessage(error) };
  }

  after(async () => {
    await revalidateMainApp([cacheTagCourse({ courseSlug })]);
  });

  return { error: null };
}

export async function exportChaptersAction(courseId: number): Promise<{
  data: object | null;
  error: Error | null;
}> {
  const { data, error } = await exportChapters({ courseId });

  if (error) {
    return { data: null, error };
  }

  return { data, error: null };
}

type CourseRouteParams = {
  courseId: number;
  courseSlug: string;
  orgSlug: string;
};

export async function insertChapterAction(
  params: CourseRouteParams,
  position: number,
): Promise<void> {
  const { courseId, courseSlug, orgSlug } = params;
  const { slug, error } = await createChapterAction(courseSlug, courseId, position);

  if (error) {
    throw new Error(error);
  }

  if (slug) {
    revalidatePath(`/${orgSlug}/c/${courseSlug}`);
    redirect(`/${orgSlug}/c/${courseSlug}/ch/${slug}`);
  }
}

export async function handleImportChaptersAction(
  params: CourseRouteParams,
  formData: FormData,
): Promise<{ error: string | null }> {
  const { courseId, courseSlug, orgSlug } = params;
  const { error } = await importChaptersAction(courseSlug, courseId, formData);

  if (error) {
    return { error };
  }

  revalidatePath(`/${orgSlug}/c/${courseSlug}`);
  return { error: null };
}

export async function reorderChaptersAction(
  params: CourseRouteParams,
  chapters: { id: number; position: number }[],
): Promise<{ error: string | null }> {
  const { courseId, courseSlug, orgSlug } = params;

  const { error } = await reorderChapters({
    chapters: chapters.map((chapter) => ({ chapterId: chapter.id, position: chapter.position })),
    courseId,
  });

  if (error) {
    return { error: await getErrorMessage(error) };
  }

  after(async () => {
    await revalidateMainApp([cacheTagCourse({ courseSlug })]);
  });

  revalidatePath(`/${orgSlug}/c/${courseSlug}`);
  return { error: null };
}
