"use server";

import { revalidateMainApp } from "@zoonk/core/cache/revalidate";
import { processAndUploadImage } from "@zoonk/core/images/process-and-upload";
import { cacheTagCourse } from "@zoonk/utils/cache";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { getExtracted } from "next-intl/server";
import { createChapter } from "@/data/chapters/create-chapter";
import { exportChapters } from "@/data/chapters/export-chapters";
import { importChapters } from "@/data/chapters/import-chapters";
import { reorderChapters } from "@/data/chapters/reorder-chapters";
import { courseSlugExists } from "@/data/courses/course-slug";
import { updateCourse } from "@/data/courses/update-course";
import { getErrorMessage } from "@/lib/error-messages";

export async function checkCourseSlugExists(params: {
  language: string;
  orgSlug: string;
  slug: string;
}): Promise<boolean> {
  return courseSlugExists(params);
}

export async function updateCourseTitleAction(
  courseSlug: string,
  courseId: number,
  data: { title: string },
): Promise<{ error: string | null }> {
  const { error } = await updateCourse({
    courseId,
    title: data.title,
  });

  if (error) {
    return { error: await getErrorMessage(error) };
  }

  after(async () => {
    await revalidateMainApp([cacheTagCourse({ courseSlug })]);
  });

  return { error: null };
}

export async function updateCourseDescriptionAction(
  courseSlug: string,
  courseId: number,
  data: { description: string },
): Promise<{ error: string | null }> {
  const { error } = await updateCourse({
    courseId,
    description: data.description,
  });

  if (error) {
    return { error: await getErrorMessage(error) };
  }

  after(async () => {
    await revalidateMainApp([cacheTagCourse({ courseSlug })]);
  });

  return { error: null };
}

export async function updateCourseSlugAction(
  currentSlug: string,
  courseId: number,
  data: { slug: string },
): Promise<{ error: string | null; newSlug?: string }> {
  const { data: course, error } = await updateCourse({
    courseId,
    slug: data.slug,
  });

  if (error) {
    return { error: await getErrorMessage(error) };
  }

  after(async () => {
    await revalidateMainApp([
      cacheTagCourse({ courseSlug: currentSlug }),
      cacheTagCourse({ courseSlug: course.slug }),
    ]);
  });

  return { error: null, newSlug: course.slug };
}

export async function createChapterAction(
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

export async function importChaptersAction(
  courseSlug: string,
  courseId: number,
  formData: FormData,
): Promise<{ error: string | null }> {
  const file = formData.get("file");
  const mode = formData.get("mode") as "merge" | "replace";

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

type ChapterRouteParams = {
  courseId: number;
  courseSlug: string;
  lang: string;
  orgSlug: string;
};

export async function insertChapterAction(
  params: ChapterRouteParams,
  position: number,
): Promise<void> {
  const { courseId, courseSlug, lang, orgSlug } = params;
  const { slug, error } = await createChapterAction(
    courseSlug,
    courseId,
    position,
  );

  if (error) {
    throw new Error(error);
  }

  if (slug) {
    revalidatePath(`/${orgSlug}/c/${lang}/${courseSlug}`);
    redirect(`/${orgSlug}/c/${lang}/${courseSlug}/ch/${slug}`);
  }
}

export async function handleImportChaptersAction(
  params: ChapterRouteParams,
  formData: FormData,
): Promise<{ error: string | null }> {
  const { courseId, courseSlug, lang, orgSlug } = params;
  const { error } = await importChaptersAction(courseSlug, courseId, formData);

  if (error) {
    return { error };
  }

  revalidatePath(`/${orgSlug}/c/${lang}/${courseSlug}`);
  return { error: null };
}

export async function reorderChaptersAction(
  params: ChapterRouteParams,
  chapters: { id: number; position: number }[],
): Promise<{ error: string | null }> {
  const { courseId, courseSlug, lang, orgSlug } = params;

  const { error } = await reorderChapters({
    chapters: chapters.map((c) => ({ chapterId: c.id, position: c.position })),
    courseId,
  });

  if (error) {
    return { error: await getErrorMessage(error) };
  }

  after(async () => {
    await revalidateMainApp([cacheTagCourse({ courseSlug })]);
  });

  revalidatePath(`/${orgSlug}/c/${lang}/${courseSlug}`);
  return { error: null };
}

export async function uploadCourseImageAction(
  params: ChapterRouteParams,
  formData: FormData,
): Promise<{ error: string | null }> {
  const { courseId, courseSlug, lang, orgSlug } = params;
  const file = formData.get("file");
  const t = await getExtracted();

  if (!(file && file instanceof File)) {
    return { error: t("No file provided") };
  }

  const { data: imageUrl, error: uploadError } = await processAndUploadImage({
    file,
    fileName: `courses/${courseId}/cover.webp`,
  });

  if (uploadError) {
    const errorMessages: Record<typeof uploadError, string> = {
      invalidType: t(
        "Invalid file type. Please upload a JPEG, PNG, WebP, or GIF image.",
      ),
      optimizeFailed: t("Failed to process image. Please try again."),
      tooLarge: t("File is too large. Maximum size is 5MB."),
      uploadFailed: t("Failed to upload image. Please try again."),
    };

    return { error: errorMessages[uploadError] };
  }

  const { error: updateError } = await updateCourse({
    courseId,
    imageUrl,
  });

  if (updateError) {
    return { error: await getErrorMessage(updateError) };
  }

  after(async () => {
    await revalidateMainApp([cacheTagCourse({ courseSlug })]);
  });

  revalidatePath(`/${orgSlug}/c/${lang}/${courseSlug}`);
  return { error: null };
}

export async function removeCourseImageAction(
  params: ChapterRouteParams,
): Promise<{ error: string | null }> {
  const { courseId, courseSlug, lang, orgSlug } = params;
  const { error } = await updateCourse({
    courseId,
    imageUrl: null,
  });

  if (error) {
    return { error: await getErrorMessage(error) };
  }

  after(async () => {
    await revalidateMainApp([cacheTagCourse({ courseSlug })]);
  });

  revalidatePath(`/${orgSlug}/c/${lang}/${courseSlug}`);
  return { error: null };
}
