type ChapterCourses = {
  homeCourse: { title: string } | null;
  courses: { course: { title: string } }[];
};

function unique(titles: readonly (string | undefined)[]): string[] {
  return [...new Set(titles.filter((title): title is string => Boolean(title)))];
}

export function listChapterCourses(chapter: ChapterCourses): string[] {
  return unique([
    chapter.homeCourse?.title,
    ...chapter.courses.map((placement) => placement.course.title),
  ]);
}

export function listChaptersCourses(item: { chapters: { chapter: ChapterCourses }[] }): string[] {
  return unique(item.chapters.flatMap((entry) => listChapterCourses(entry.chapter)));
}
