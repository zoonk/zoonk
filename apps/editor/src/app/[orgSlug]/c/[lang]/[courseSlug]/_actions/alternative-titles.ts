"use server";

import { deleteAlternativeTitles } from "@/data/alternative-titles/delete-alternative-titles";
import { exportAlternativeTitles } from "@/data/alternative-titles/export-alternative-titles";
import { importAlternativeTitles } from "@/data/alternative-titles/import-alternative-titles";
import { getErrorMessage } from "@/lib/error-messages";
import { isImportMode } from "@/lib/import-mode";
import { addAlternativeTitles } from "@zoonk/core/alternative-titles/add";
import { getExtracted } from "next-intl/server";
import { revalidatePath } from "next/cache";

type ChapterRouteParams = {
  courseId: number;
  courseSlug: string;
  lang: string;
  orgSlug: string;
};

export async function addAlternativeTitleAction(
  params: ChapterRouteParams,
  title: string,
): Promise<{ error: string | null }> {
  const { courseId, courseSlug, lang, orgSlug } = params;
  const t = await getExtracted();

  if (!title.trim()) {
    return { error: t("Title is required") };
  }

  const { error } = await addAlternativeTitles({
    courseId,
    language: lang,
    titles: [title],
  });

  if (error) {
    return { error: t("Failed to add alternative title") };
  }

  revalidatePath(`/${orgSlug}/c/${lang}/${courseSlug}`);
  return { error: null };
}

export async function deleteAlternativeTitleAction(
  params: ChapterRouteParams,
  slug: string,
): Promise<{ error: string | null }> {
  const { courseId, courseSlug, lang, orgSlug } = params;

  await deleteAlternativeTitles({
    courseId,
    titles: [slug],
  });

  revalidatePath(`/${orgSlug}/c/${lang}/${courseSlug}`);
  return { error: null };
}

export async function importAlternativeTitlesAction(
  params: ChapterRouteParams,
  formData: FormData,
): Promise<{ error: string | null }> {
  const { courseId, courseSlug, lang, orgSlug } = params;
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
    language: lang,
    mode,
  });

  if (error) {
    return { error: await getErrorMessage(error) };
  }

  revalidatePath(`/${orgSlug}/c/${lang}/${courseSlug}`);
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
