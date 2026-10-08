type ChapterCourses = {
  homeCourse: { title: string } | null;
  courses: { course: { title: string } }[];
};

function unique(titles: readonly (string | undefined)[]): string[] {
  return [...new Set(titles.filter((title): title is string => Boolean(title)))];
}

/** A chapter's courses as the reuse decision reads them: its home course, then the courses placing it. */
export function listChapterCourses(chapter: ChapterCourses): string[] {
  return unique([
    chapter.homeCourse?.title,
    ...chapter.courses.map((placement) => placement.course.title),
  ]);
}

/** A lesson's or a skill's courses: those of every chapter it's in. */
export function listChaptersCourses(item: { chapters: { chapter: ChapterCourses }[] }): string[] {
  return unique(item.chapters.flatMap((entry) => listChapterCourses(entry.chapter)));
}
