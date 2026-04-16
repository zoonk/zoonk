"use server";

import { addAlternativeTitles } from "@/data/alternative-titles/add-alternative-titles";
import { deleteAlternativeTitles } from "@/data/alternative-titles/delete-alternative-titles";
import { exportAlternativeTitles } from "@/data/alternative-titles/export-alternative-titles";
import { importAlternativeTitles } from "@/data/alternative-titles/import-alternative-titles";
import { getAuthorizedActiveCourse } from "@/data/courses/get-authorized-course";
import { getErrorMessage } from "@/lib/error-messages";
import { isImportMode } from "@/lib/import-mode";
import { getExtracted } from "next-intl/server";
import { revalidatePath } from "next/cache";

type CourseActionParams = {
  courseId: string;
  language: string;
};

export async function addAlternativeTitleAction(
  params: CourseActionParams,
  title: string,
): Promise<{ error: string | null }> {
  const { courseId, language } = params;
  const t = await getExtracted();

  if (!title.trim()) {
    return { error: t("Title is required") };
  }

  const { data: course, error: courseError } = await getAuthorizedActiveCourse({
    courseId,
  });

  if (courseError) {
    return { error: await getErrorMessage(courseError) };
  }

  const { error } = await addAlternativeTitles({
    courseId,
    language,
    titles: [title],
  });

  if (error) {
    return { error: t("Failed to add alternative title") };
  }

  revalidatePath(`/${course.organization.slug}/c/${course.slug}`);
  return { error: null };
}

export async function deleteAlternativeTitleAction(
  params: CourseActionParams,
  slug: string,
): Promise<{ error: string | null }> {
  const { courseId } = params;
  const { data: course, error: courseError } = await getAuthorizedActiveCourse({
    courseId,
  });

  if (courseError) {
    return { error: await getErrorMessage(courseError) };
  }

  const { error } = await deleteAlternativeTitles({
    courseId,
    titles: [slug],
  });

  if (error) {
    return { error: await getErrorMessage(error) };
  }

  revalidatePath(`/${course.organization.slug}/c/${course.slug}`);
  return { error: null };
}

export async function importAlternativeTitlesAction(
  params: CourseActionParams,
  formData: FormData,
): Promise<{ error: string | null }> {
  const { courseId, language } = params;
  const file = formData.get("file");
  const modeValue = formData.get("mode");
  const mode = isImportMode(modeValue) ? modeValue : "merge";

  if (!(file && file instanceof File)) {
    const t = await getExtracted();
    return { error: t("No file provided") };
  }

  const { data: course, error: courseError } = await getAuthorizedActiveCourse({
    courseId,
  });

  if (courseError) {
    return { error: await getErrorMessage(courseError) };
  }

  const { error } = await importAlternativeTitles({
    courseId,
    file,
    language,
    mode,
  });

  if (error) {
    return { error: await getErrorMessage(error) };
  }

  revalidatePath(`/${course.organization.slug}/c/${course.slug}`);
  return { error: null };
}

export async function exportAlternativeTitlesAction(courseId: string): Promise<{
  data: object | null;
  error: Error | null;
}> {
  const { data, error } = await exportAlternativeTitles({ courseId });

  if (error) {
    return { data: null, error };
  }

  return { data, error: null };
}
