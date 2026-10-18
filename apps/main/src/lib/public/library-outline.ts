type Outline = {
  levels: readonly { chapters: readonly { lessons: readonly { estimatedMinutes: number }[] }[] }[];
};

/** Counts and total estimated time of a course outline, for its summary lines and workload. */
export function getLibraryOutlineStats(outline: Outline) {
  const chapters = outline.levels.flatMap((band) => band.chapters);
  const lessons = chapters.flatMap((chapter) => chapter.lessons);

  return {
    chapterCount: chapters.length,
    lessonCount: lessons.length,
    totalMinutes: lessons.reduce((sum, lesson) => sum + lesson.estimatedMinutes, 0),
  };
}
