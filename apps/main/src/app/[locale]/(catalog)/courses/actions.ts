"use server";

import { listCourses } from "@/data/courses/list-courses";
import { type CourseCategory } from "@zoonk/utils/categories";

export async function loadMoreCourses(params: {
  category?: CourseCategory;
  language: string;
  offset: number;
}) {
  const courses = await listCourses({
    category: params.category,
    language: params.language,
    offset: params.offset,
  });

  return courses;
}
