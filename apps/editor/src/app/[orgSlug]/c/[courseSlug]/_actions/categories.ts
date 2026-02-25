"use server";

import { addCategoryToCourse } from "@/data/categories/add-category-to-course";
import { removeCategoryFromCourse } from "@/data/categories/remove-category-from-course";
import { getErrorMessage } from "@/lib/error-messages";
import { revalidateMainApp } from "@zoonk/core/cache/revalidate";
import { cacheTagCourse } from "@zoonk/utils/cache";
import { revalidatePath } from "next/cache";
import { after } from "next/server";

type CourseRouteParams = {
  courseId: number;
  courseSlug: string;
  orgSlug: string;
};

export async function addCourseCategoryAction(
  params: CourseRouteParams,
  category: string,
): Promise<{ error: string | null }> {
  const { courseId, courseSlug, orgSlug } = params;

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

  revalidatePath(`/${orgSlug}/c/${courseSlug}`);

  return { error: null };
}

export async function removeCourseCategoryAction(
  params: CourseRouteParams,
  category: string,
): Promise<{ error: string | null }> {
  const { courseId, courseSlug, orgSlug } = params;

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

  revalidatePath(`/${orgSlug}/c/${courseSlug}`);

  return { error: null };
}
