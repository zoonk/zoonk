"use server";

import { toggleCoursePublished } from "@zoonk/core/courses";
import { revalidateMainApp } from "@zoonk/core/revalidate";
import { cacheTagCourse } from "@zoonk/utils/cache";
import { updateTag } from "next/cache";
import { after } from "next/server";
import { getExtracted } from "next-intl/server";

export async function togglePublishAction(
  courseId: number,
  orgSlug: string,
  isPublished: boolean,
): Promise<{ error: string | null }> {
  const t = await getExtracted();

  const { error } = await toggleCoursePublished({
    courseId,
    isPublished,
    orgSlug,
  });

  if (error) {
    return { error: error.message ?? t("Failed to update course") };
  }

  const tag = cacheTagCourse({ courseId });

  updateTag(tag);

  after(async () => {
    await revalidateMainApp([tag]);
  });

  return { error: null };
}
