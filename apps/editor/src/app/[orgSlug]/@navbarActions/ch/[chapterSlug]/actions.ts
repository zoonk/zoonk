"use server";

import { revalidateMainApp } from "@zoonk/core/cache/revalidate";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { deleteChapter } from "@/data/chapters/delete-chapter";
import { toggleChapterPublished } from "@/data/chapters/publish-chapter";
import { getChapterCacheTags } from "@/lib/cache";
import { getErrorMessage } from "@/lib/error-messages";

export async function togglePublishAction(
  chapterId: number,
  isPublished: boolean,
): Promise<{ error: string | null }> {
  const { error } = await toggleChapterPublished({
    chapterId,
    isPublished,
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

export async function deleteChapterAction(
  chapterId: number,
  orgSlug: string,
): Promise<{ error: string | null }> {
  // Get cache tags before deleting (while relationships still exist)
  const tags = await getChapterCacheTags(chapterId);

  const { error } = await deleteChapter({ chapterId });

  if (error) {
    return { error: await getErrorMessage(error) };
  }

  after(async () => {
    await revalidateMainApp(tags);
  });

  redirect(`/${orgSlug}`);
}
