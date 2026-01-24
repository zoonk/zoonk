"use server";

import { listCourses } from "@/data/courses/list-courses";
import { type CourseCategory } from "@zoonk/utils/categories";

export async function loadMoreCourses(params: {
  category?: CourseCategory;
  cursor: number;
  language: string;
}) {
  const courses = await listCourses({
    category: params.category,
    cursor: params.cursor,
    language: params.language,
  });

  return courses;
}
