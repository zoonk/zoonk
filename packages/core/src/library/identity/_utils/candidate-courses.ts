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

/** A lesson's courses: those of every chapter it's placed in. */
export function listLessonCourses(lesson: { chapters: { chapter: ChapterCourses }[] }): string[] {
  return unique(lesson.chapters.flatMap((entry) => listChapterCourses(entry.chapter)));
}
