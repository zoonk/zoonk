"use server";

import { addCategoryToCourse } from "@/data/categories/add-category-to-course";
import { removeCategoryFromCourse } from "@/data/categories/remove-category-from-course";
import { getErrorMessage } from "@/lib/error-messages";
import { revalidateMainApp } from "@zoonk/core/cache/revalidate";
import { cacheTagCourse } from "@zoonk/utils/cache";
import { revalidatePath } from "next/cache";
import { after } from "next/server";

type ChapterRouteParams = {
  courseId: number;
  courseSlug: string;
  lang: string;
  orgSlug: string;
};

export async function addCourseCategoryAction(
  params: ChapterRouteParams,
  category: string,
): Promise<{ error: string | null }> {
  const { courseId, courseSlug, lang, orgSlug } = params;

  const { error } = await addCategoryToCourse({
    category,
    courseId,
  });

  if (error) {
    return { error: await getErrorMessage(error) };
  }

  after(async () => {
    await revalidateMainApp([cacheTagCourse({ courseSlug })]);
  });

  revalidatePath(`/${orgSlug}/c/${lang}/${courseSlug}`);

  return { error: null };
}

export async function removeCourseCategoryAction(
  params: ChapterRouteParams,
  category: string,
): Promise<{ error: string | null }> {
  const { courseId, courseSlug, lang, orgSlug } = params;

  const { error } = await removeCategoryFromCourse({
    category,
    courseId,
  });

  if (error) {
    return { error: await getErrorMessage(error) };
  }

  after(async () => {
    await revalidateMainApp([cacheTagCourse({ courseSlug })]);
  });

  revalidatePath(`/${orgSlug}/c/${lang}/${courseSlug}`);

  return { error: null };
}
