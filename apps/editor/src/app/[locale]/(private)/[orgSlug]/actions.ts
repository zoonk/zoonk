"use server";

import { searchCourses } from "@zoonk/core/courses";

export async function searchCoursesAction(orgSlug: string, query: string) {
  const { data, error } = await searchCourses({
    orgSlug,
    title: query,
  });

  if (error) {
    return { courses: [], error: error.message };
  }

  return { courses: data, error: null };
}
