"use server";

import { deleteChapter } from "@/data/chapters/delete-chapter";
import { toggleChapterPublished } from "@/data/chapters/publish-chapter";
import { getErrorMessage } from "@/lib/error-messages";
import { type Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function togglePublishAction(
  params: { chapterId: number; chapterUrl: string },
  isPublished: boolean,
): Promise<{ error: string | null }> {
  const { chapterId, chapterUrl } = params;

  const { error } = await toggleChapterPublished({
    chapterId,
    isPublished,
  });

  if (error) {
    return { error: await getErrorMessage(error) };
  }

  revalidatePath(chapterUrl);

  return { error: null };
}

export async function deleteChapterAction(
  chapterId: number,
  courseUrl: Route,
): Promise<{ error: string | null }> {
  const { error } = await deleteChapter({ chapterId });

  if (error) {
    return { error: await getErrorMessage(error) };
  }

  revalidatePath(courseUrl);
  redirect(courseUrl);
}
