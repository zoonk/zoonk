"use server";

import { revalidateMainApp } from "@zoonk/core/cache/revalidate";
import { after } from "next/server";
import { updateChapter } from "@/data/chapters/update-chapter";
import { getChapterCacheTags } from "@/lib/cache";
import { getErrorMessage } from "@/lib/error-messages";

export async function updateChapterTitleAction(
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
    const tags = await getChapterCacheTags(chapterId);
    await revalidateMainApp(tags);
  });

  return { error: null };
}

export async function updateChapterDescriptionAction(
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
    const tags = await getChapterCacheTags(chapterId);
    await revalidateMainApp(tags);
  });

  return { error: null };
}
