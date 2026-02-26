"use server";

import { addCategoryToCourse } from "@/data/categories/add-category-to-course";
import { removeCategoryFromCourse } from "@/data/categories/remove-category-from-course";
import { getErrorMessage } from "@/lib/error-messages";
import { revalidatePath } from "next/cache";

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

  revalidatePath(`/${orgSlug}/c/${courseSlug}`);

  return { error: null };
}
