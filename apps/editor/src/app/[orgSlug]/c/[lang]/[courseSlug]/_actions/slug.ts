"use server";

import { courseSlugExists } from "@/data/courses/course-slug";
import { updateCourse } from "@/data/courses/update-course";
import { getErrorMessage } from "@/lib/error-messages";
import { revalidateMainApp } from "@zoonk/core/cache/revalidate";
import { cacheTagCourse } from "@zoonk/utils/cache";
import { after } from "next/server";

export async function checkCourseSlugExists(params: {
  language: string;
  orgSlug: string;
  slug: string;
}): Promise<boolean> {
  return courseSlugExists(params);
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
