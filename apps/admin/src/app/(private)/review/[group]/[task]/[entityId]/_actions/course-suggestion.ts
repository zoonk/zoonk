"use server";

import { assertAdmin } from "@/lib/admin-guard";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { parseFormField } from "@zoonk/utils/form";
import { toSlug } from "@zoonk/utils/string";
import { revalidatePath } from "next/cache";

export async function updateCourseSuggestionAction(formData: FormData) {
  await assertAdmin();

  const suggestionIdRaw = parseFormField(formData, "suggestionId");
  const title = parseFormField(formData, "title");
  const description = parseFormField(formData, "description");

  if (!suggestionIdRaw || !title || !description) {
    throw new Error("Invalid form data");
  }

  const suggestionId = Number(suggestionIdRaw);

  const { error } = await safeAsync(() =>
    prisma.courseSuggestion.update({
      data: { description, slug: toSlug(title), title },
      where: { id: suggestionId },
    }),
  );

  if (error) {
    throw error;
  }

  revalidatePath("/review");
}

export async function removeCourseSuggestionAction(formData: FormData) {
  await assertAdmin();

  const searchPromptIdRaw = parseFormField(formData, "searchPromptId");
  const courseSuggestionIdRaw = parseFormField(formData, "courseSuggestionId");

  if (!searchPromptIdRaw || !courseSuggestionIdRaw) {
    throw new Error("Invalid form data");
  }

  const searchPromptId = Number(searchPromptIdRaw);
  const courseSuggestionId = Number(courseSuggestionIdRaw);

  const { error } = await safeAsync(() =>
    prisma.searchPromptSuggestion.delete({
      where: { promptSuggestion: { courseSuggestionId, searchPromptId } },
    }),
  );

  if (error) {
    throw error;
  }

  revalidatePath("/review");
}

export async function addCourseSuggestionAction(formData: FormData) {
  await assertAdmin();

  const searchPromptIdRaw = parseFormField(formData, "searchPromptId");
  const title = parseFormField(formData, "title");
  const description = parseFormField(formData, "description");
  const language = parseFormField(formData, "language");
  const targetLanguage = parseFormField(formData, "targetLanguage");

  const searchPromptId = searchPromptIdRaw ? Number(searchPromptIdRaw) : null;

  if (!searchPromptId || !title || !description || !language) {
    throw new Error("Invalid form data");
  }

  const { error } = await safeAsync(async () => {
    const maxPosition = await prisma.searchPromptSuggestion.aggregate({
      _max: { position: true },
      where: { searchPromptId },
    });

    const position = (maxPosition._max.position ?? -1) + 1;

    const slug = toSlug(title);

    const suggestion = await prisma.courseSuggestion.upsert({
      create: {
        description,
        language,
        slug,
        targetLanguage: targetLanguage || null,
        title,
      },
      update: { description, title },
      where: { languageSlug: { language, slug } },
    });

    await prisma.searchPromptSuggestion.create({
      data: { courseSuggestionId: suggestion.id, position, searchPromptId },
    });
  });

  if (error) {
    throw error;
  }

  revalidatePath("/review");
}
