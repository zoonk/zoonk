"use server";

import { deleteAlternativeTitles } from "@/data/alternative-titles/delete-alternative-titles";
import { exportAlternativeTitles } from "@/data/alternative-titles/export-alternative-titles";
import { importAlternativeTitles } from "@/data/alternative-titles/import-alternative-titles";
import { getErrorMessage } from "@/lib/error-messages";
import { isImportMode } from "@/lib/import-mode";
import { addAlternativeTitles } from "@zoonk/core/alternative-titles/add";
import { getExtracted } from "next-intl/server";
import { revalidatePath } from "next/cache";

type CourseRouteParams = {
  courseId: number;
  courseSlug: string;
  language: string;
  orgSlug: string;
};

export async function addAlternativeTitleAction(
  params: CourseRouteParams,
  title: string,
): Promise<{ error: string | null }> {
  const { courseId, courseSlug, language, orgSlug } = params;
  const t = await getExtracted();

  if (!title.trim()) {
    return { error: t("Title is required") };
  }

  const { error } = await addAlternativeTitles({
    courseId,
    language,
    titles: [title],
  });

  if (error) {
    return { error: t("Failed to add alternative title") };
  }

  revalidatePath(`/${orgSlug}/c/${courseSlug}`);
  return { error: null };
}

export async function deleteAlternativeTitleAction(
  params: CourseRouteParams,
  slug: string,
): Promise<{ error: string | null }> {
  const { courseId, courseSlug, orgSlug } = params;

  await deleteAlternativeTitles({
    courseId,
    titles: [slug],
  });

  revalidatePath(`/${orgSlug}/c/${courseSlug}`);
  return { error: null };
}

export async function importAlternativeTitlesAction(
  params: CourseRouteParams,
  formData: FormData,
): Promise<{ error: string | null }> {
  const { courseId, courseSlug, language, orgSlug } = params;
  const file = formData.get("file");
  const modeValue = formData.get("mode");
  const mode = isImportMode(modeValue) ? modeValue : "merge";

  if (!(file && file instanceof File)) {
    const t = await getExtracted();
    return { error: t("No file provided") };
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

  revalidatePath(`/${orgSlug}/c/${courseSlug}`);
  return { error: null };
}

export async function exportAlternativeTitlesAction(courseId: number): Promise<{
  data: object | null;
  error: Error | null;
}> {
  const { data, error } = await exportAlternativeTitles({ courseId });

  if (error) {
    return { data: null, error };
  }

  return { data, error: null };
}
