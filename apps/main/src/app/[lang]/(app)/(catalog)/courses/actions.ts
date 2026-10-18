"use server";

import { listCourses } from "@zoonk/core/courses/list";
import { type CourseCategory } from "@zoonk/utils/categories";

export async function loadMoreCourses(params: {
  category?: CourseCategory;
  cursor: string;
  language: string;
}) {
  const courses = await listCourses({
    category: params.category,
    cursor: params.cursor,
    language: params.language,
  });

  return courses;
}
