"use server";

import { revalidateMainApp } from "@zoonk/core/cache/revalidate";
import { cacheTagCourse } from "@zoonk/utils/cache";
import { after } from "next/server";
import { courseSlugExists } from "@/data/courses/course-slug";
import { updateCourse } from "@/data/courses/update-course";
import { getErrorMessage } from "@/lib/error-messages";

export async function checkCourseSlugExists(params: {
  language: string;
  orgSlug: string;
  slug: string;
}): Promise<boolean> {
  return courseSlugExists(params);
}

export async function updateCourseTitleAction(
  courseSlug: string,
  courseId: number,
  data: { title: string },
): Promise<{ error: string | null }> {
  const { error } = await updateCourse({
    courseId,
    title: data.title,
  });

  if (error) {
    return { error: await getErrorMessage(error) };
  }

  after(async () => {
    await revalidateMainApp([cacheTagCourse({ courseSlug })]);
  });

  return { error: null };
}

export async function updateCourseDescriptionAction(
  courseSlug: string,
  courseId: number,
  data: { description: string },
): Promise<{ error: string | null }> {
  const { error } = await updateCourse({
    courseId,
    description: data.description,
  });

  if (error) {
    return { error: await getErrorMessage(error) };
  }

  after(async () => {
    await revalidateMainApp([cacheTagCourse({ courseSlug })]);
  });

  return { error: null };
}

export async function updateCourseSlugAction(
  currentSlug: string,
  courseId: number,
  data: { slug: string },
): Promise<{ error: string | null; newSlug?: string }> {
  const { data: course, error } = await updateCourse({
    courseId,
    slug: data.slug,
  });

  if (error) {
    return { error: await getErrorMessage(error) };
  }

  after(async () => {
    await revalidateMainApp([
      cacheTagCourse({ courseSlug: currentSlug }),
      cacheTagCourse({ courseSlug: course.slug }),
    ]);
  });

  return { error: null, newSlug: course.slug };
}
