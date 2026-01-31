"use server";

import { searchCourses } from "@zoonk/core/courses/search";

export type CourseSearchResult = {
  id: number;
  title: string;
  description: string | null;
  slug: string;
  imageUrl: string | null;
  brandSlug: string;
};

export async function searchCoursesAction(params: {
  query: string;
  language: string;
}): Promise<CourseSearchResult[]> {
  const courses = await searchCourses(params);

  return courses.map((course) => ({
    brandSlug: course.organization.slug,
    description: course.description,
    id: course.id,
    imageUrl: course.imageUrl,
    slug: course.slug,
    title: course.title,
  }));
}
