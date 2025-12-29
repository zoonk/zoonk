"use server";

import { listCourses } from "@/data/courses/list-courses";

export async function loadMoreCourses(params: {
  cursor: number;
  language: string;
}) {
  const courses = await listCourses({
    cursor: params.cursor,
    language: params.language,
  });

  return courses;
}
