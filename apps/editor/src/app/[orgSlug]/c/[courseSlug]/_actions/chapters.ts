"use server";

import { createChapter } from "@/data/chapters/create-chapter";
import { exportChapters } from "@/data/chapters/export-chapters";
import { importChapters } from "@/data/chapters/import-chapters";
import { reorderChapters } from "@/data/chapters/reorder-chapters";
import { getAuthorizedActiveCourse } from "@/data/courses/get-authorized-course";
import { getErrorMessage } from "@/lib/error-messages";
import { isImportMode } from "@/lib/import-mode";
import { getExtracted } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

async function createChapterAction(
  courseId: string,
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

  return { error: null, slug: data.slug };
}

async function importChaptersAction(
  courseId: string,
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

  return { error: null };
}

export async function exportChaptersAction(courseId: string): Promise<{
  data: object | null;
  error: Error | null;
}> {
  const { data, error } = await exportChapters({ courseId });

  if (error) {
    return { data: null, error };
  }

  return { data, error: null };
}

type CourseActionParams = {
  courseId: string;
};

/**
 * Chapter page actions only make sense while the course page is still active, so
 * this helper resolves the canonical route on the server before we revalidate or
 * redirect instead of trusting route params captured at render time.
 */
async function getAuthorizedCoursePagePath(courseId: string): Promise<
  | {
      error: string;
      path: null;
    }
  | {
      error: null;
      path: `/${string}/c/${string}`;
    }
> {
  const { data: course, error } = await getAuthorizedActiveCourse({ courseId });

  if (error) {
    return { error: await getErrorMessage(error), path: null };
  }

  return {
    error: null,
    path: `/${course.organization.slug}/c/${course.slug}` as const,
  };
}

export async function insertChapterAction(
  params: CourseActionParams,
  position: number,
): Promise<void> {
  const { courseId } = params;
  const coursePage = await getAuthorizedCoursePagePath(courseId);

  if (coursePage.error) {
    throw new Error(coursePage.error);
  }

  const path = coursePage.path;

  if (!path) {
    throw new Error("Failed to resolve course path");
  }

  const { slug, error } = await createChapterAction(courseId, position);

  if (error) {
    throw new Error(error);
  }

  if (slug) {
    const chapterPath = `${path}/ch/${slug}` as const;
    revalidatePath(path);
    redirect(chapterPath);
  }
}

export async function handleImportChaptersAction(
  params: CourseActionParams,
  formData: FormData,
): Promise<{ error: string | null }> {
  const { courseId } = params;
  const coursePage = await getAuthorizedCoursePagePath(courseId);

  if (coursePage.error) {
    return { error: coursePage.error };
  }

  const path = coursePage.path;

  if (!path) {
    return { error: "Failed to resolve course path" };
  }

  const { error } = await importChaptersAction(courseId, formData);

  if (error) {
    return { error };
  }

  revalidatePath(path);
  return { error: null };
}

export async function reorderChaptersAction(
  params: CourseActionParams,
  chapters: { id: string; position: number }[],
): Promise<{ error: string | null }> {
  const { courseId } = params;
  const coursePage = await getAuthorizedCoursePagePath(courseId);

  if (coursePage.error) {
    return { error: coursePage.error };
  }

  const path = coursePage.path;

  if (!path) {
    return { error: "Failed to resolve course path" };
  }

  const { error } = await reorderChapters({
    chapters: chapters.map((chapter) => ({ chapterId: chapter.id, position: chapter.position })),
    courseId,
  });

  if (error) {
    return { error: await getErrorMessage(error) };
  }

  revalidatePath(path);
  return { error: null };
}
