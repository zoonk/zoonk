"use server";

import { searchOrgChapters } from "@/data/chapters/search-org-chapters";
import { searchCourses } from "@/data/courses/search-courses";
import { searchOrgLessons } from "@/data/lessons/search-org-lessons";
import { headers } from "next/headers";
import { cache } from "react";

export type ResultWithImage = {
  id: number;
  type: "course";
  title: string;
  description: string | null;
  url: string;
  imageUrl: string | null;
};

export type ResultWithPosition = {
  id: number;
  type: "chapter" | "lesson";
  title: string;
  description: string | null;
  url: string;
  position: number;
};

export type SearchResults = {
  courses: ResultWithImage[];
  chapters: ResultWithPosition[];
  lessons: ResultWithPosition[];
};

const cachedSearchContent = cache(
  async (title: string, orgSlug: string, limit?: number): Promise<SearchResults> => {
    if (!title.trim()) {
      return { chapters: [], courses: [], lessons: [] };
    }

    const requestHeaders = await headers();

    const [coursesResult, chaptersResult, lessonsResult] = await Promise.all([
      searchCourses({ headers: requestHeaders, limit, orgSlug, title }),
      searchOrgChapters({ headers: requestHeaders, limit, orgSlug, title }),
      searchOrgLessons({ headers: requestHeaders, limit, orgSlug, title }),
    ]);

    const courses: ResultWithImage[] = coursesResult.data.map((course) => ({
      description: course.description,
      id: course.id,
      imageUrl: course.imageUrl,
      title: course.title,
      type: "course",
      url: `/${orgSlug}/c/${course.language}/${course.slug}`,
    }));

    const chapters: ResultWithPosition[] = chaptersResult.data.map((chapter) => ({
      description: chapter.description,
      id: chapter.id,
      position: chapter.position,
      title: chapter.title,
      type: "chapter",
      url: `/${orgSlug}/c/${chapter.course.language}/${chapter.course.slug}/ch/${chapter.slug}`,
    }));

    const lessons: ResultWithPosition[] = lessonsResult.data.map((lesson) => ({
      description: lesson.description,
      id: lesson.id,
      position: lesson.position,
      title: lesson.title,
      type: "lesson",
      url: `/${orgSlug}/c/${lesson.chapter.course.language}/${lesson.chapter.course.slug}/ch/${lesson.chapter.slug}/l/${lesson.slug}`,
    }));

    return { chapters, courses, lessons };
  },
);

export async function searchContent(params: {
  title: string;
  orgSlug: string;
  limit?: number;
}): Promise<SearchResults> {
  return cachedSearchContent(params.title, params.orgSlug, params.limit);
}
