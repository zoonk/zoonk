"use server";

import { revalidateMainApp } from "@zoonk/core/cache/revalidate";
import { cacheTagChapter, cacheTagCourse } from "@zoonk/utils/cache";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { deleteChapter } from "@/data/chapters/delete-chapter";
import { toggleChapterPublished } from "@/data/chapters/publish-chapter";
import { getErrorMessage } from "@/lib/error-messages";

export async function togglePublishAction(
  chapterSlug: string,
  courseSlug: string,
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
    await revalidateMainApp([
      cacheTagChapter({ chapterSlug }),
      cacheTagCourse({ courseSlug }),
    ]);
  });

  return { error: null };
}

export async function deleteChapterAction(
  chapterSlug: string,
  courseSlug: string,
  chapterId: number,
  courseUrl: Route,
): Promise<{ error: string | null }> {
  const { error } = await deleteChapter({ chapterId });

  if (error) {
    return { error: await getErrorMessage(error) };
  }

  after(async () => {
    await revalidateMainApp([
      cacheTagChapter({ chapterSlug }),
      cacheTagCourse({ courseSlug }),
    ]);
  });

  redirect(courseUrl);
}
