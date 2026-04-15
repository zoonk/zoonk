"use server";

import { addCategoryToCourse } from "@/data/categories/add-category-to-course";
import { removeCategoryFromCourse } from "@/data/categories/remove-category-from-course";
import { getAuthorizedActiveCourse } from "@/data/courses/get-authorized-course";
import { getErrorMessage } from "@/lib/error-messages";
import { revalidatePath } from "next/cache";

type CourseActionParams = {
  courseId: number;
};

export async function addCourseCategoryAction(
  params: CourseActionParams,
  category: string,
): Promise<{ error: string | null }> {
  const { courseId } = params;
  const { data: course, error: courseError } = await getAuthorizedActiveCourse({
    courseId,
  });

  if (courseError) {
    return { error: await getErrorMessage(courseError) };
  }

  const { error } = await addCategoryToCourse({
    category,
    courseId,
  });

  if (error) {
    return { error: await getErrorMessage(error) };
  }

  revalidatePath(`/${course.organization.slug}/c/${course.slug}`);

  return { error: null };
}

export async function removeCourseCategoryAction(
  params: CourseActionParams,
  category: string,
): Promise<{ error: string | null }> {
  const { courseId } = params;
  const { data: course, error: courseError } = await getAuthorizedActiveCourse({
    courseId,
  });

  if (courseError) {
    return { error: await getErrorMessage(courseError) };
  }

  const { error } = await removeCategoryFromCourse({
    category,
    courseId,
  });

  if (error) {
    return { error: await getErrorMessage(error) };
  }

  revalidatePath(`/${course.organization.slug}/c/${course.slug}`);

  return { error: null };
}
