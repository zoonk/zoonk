import { type ChapterSearchResult, type CourseSearchResult } from "@zoonk/core/catalog/search";

export type CoursePaletteItem = {
  course: CourseSearchResult;
  id: string;
  kind: "course";
  label: string;
  searchValue: string;
};

export type ChapterPaletteItem = {
  chapter: ChapterSearchResult;
  id: string;
  kind: "chapter";
  label: string;
  searchValue: string;
  showsCourse: boolean;
};

export function createCoursePaletteItem(course: CourseSearchResult): CoursePaletteItem {
  return {
    course,
    id: `course-${course.id}`,
    kind: "course",
    label: course.title,
    searchValue: [course.title, course.description, course.id].filter(Boolean).join(" "),
  };
}

/** Chapter titles are often reused across courses, so the search value includes the parent course. */
export function createChapterPaletteItem({
  chapter,
  showsCourse,
}: {
  chapter: ChapterSearchResult;
  showsCourse: boolean;
}): ChapterPaletteItem {
  return {
    chapter,
    id: `chapter-${chapter.id}`,
    kind: "chapter",
    label: chapter.title,
    searchValue: [chapter.title, chapter.courseTitle, chapter.description, chapter.id]
      .filter(Boolean)
      .join(" "),
    showsCourse,
  };
}
