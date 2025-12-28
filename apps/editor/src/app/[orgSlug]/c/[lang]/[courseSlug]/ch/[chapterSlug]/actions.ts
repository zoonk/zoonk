"use server";

import { revalidateMainApp } from "@zoonk/core/cache/revalidate";
import { cacheTagChapter, cacheTagCourse } from "@zoonk/utils/cache";
import { after } from "next/server";
import { updateChapter } from "@/data/chapters/update-chapter";
import { getErrorMessage } from "@/lib/error-messages";

export async function updateChapterTitleAction(
  chapterSlug: string,
  courseSlug: string,
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
    await revalidateMainApp([
      cacheTagChapter({ chapterSlug }),
      cacheTagCourse({ courseSlug }),
    ]);
  });

  return { error: null };
}

export async function updateChapterDescriptionAction(
  chapterSlug: string,
  courseSlug: string,
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
    await revalidateMainApp([
      cacheTagChapter({ chapterSlug }),
      cacheTagCourse({ courseSlug }),
    ]);
  });

  return { error: null };
}
