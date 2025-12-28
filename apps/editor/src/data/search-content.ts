"use server";

import { headers } from "next/headers";
import { cache } from "react";
import { searchOrgChapters } from "@/data/chapters/search-org-chapters";
import { searchCourses } from "@/data/courses/search-courses";
import { searchOrgLessons } from "@/data/lessons/search-org-lessons";

export type SearchResultCourse = {
  id: number;
  type: "course";
  title: string;
  description: string | null;
  url: string;
  imageUrl: string | null;
};

export type SearchResultChapter = {
  id: number;
  type: "chapter";
  title: string;
  description: string | null;
  url: string;
  position: number;
};

export type SearchResultLesson = {
  id: number;
  type: "lesson";
  title: string;
  description: string | null;
  url: string;
  position: number;
};

export type SearchResult =
  | SearchResultCourse
  | SearchResultChapter
  | SearchResultLesson;

export type SearchResults = {
  courses: SearchResultCourse[];
  chapters: SearchResultChapter[];
  lessons: SearchResultLesson[];
};

/**
 * Search courses, chapters, and lessons in parallel.
 * Returns grouped results for display in the command palette.
 */
export const searchContent = cache(
  async (params: {
    title: string;
    orgSlug: string;
  }): Promise<SearchResults> => {
    const { title, orgSlug } = params;

    // Don't search if no query
    if (!title.trim()) {
      return { chapters: [], courses: [], lessons: [] };
    }

    const requestHeaders = await headers();

    // Run all searches in parallel for better performance
    const [coursesResult, chaptersResult, lessonsResult] = await Promise.all([
      searchCourses({ headers: requestHeaders, orgSlug, title }),
      searchOrgChapters({ headers: requestHeaders, orgSlug, title }),
      searchOrgLessons({ headers: requestHeaders, orgSlug, title }),
    ]);

    // Transform courses
    const courses: SearchResultCourse[] = coursesResult.data.map((course) => ({
      description: course.description,
      id: course.id,
      imageUrl: course.imageUrl,
      title: course.title,
      type: "course",
      url: `/${orgSlug}/c/${course.language}/${course.slug}`,
    }));

    // Transform chapters with position
    const chapters: SearchResultChapter[] = chaptersResult.data.map(
      (chapter) => ({
        description: chapter.description,
        id: chapter.id,
        position: chapter.position,
        title: chapter.title,
        type: "chapter",
        url: `/${orgSlug}/c/${chapter.course.language}/${chapter.course.slug}/ch/${chapter.slug}`,
      }),
    );

    // Transform lessons with position
    const lessons: SearchResultLesson[] = lessonsResult.data.map((lesson) => ({
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
