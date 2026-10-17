type OutlineChapter = { homeCourseId: string | null; slug: string };
type OutlineLesson = { homeChapterId: string | null; slug: string };

/**
 * Slugs are unique only inside their home, so a course that reuses chapters
 * from other courses can list two chapters with the same slug (and a chapter
 * two lessons). The one made for this container owns the URL; otherwise the
 * first one in outline order does, which keeps the choice stable.
 */
function pickBySlug<TItem extends { slug: string }>({
  isHome,
  items,
  slug,
}: {
  isHome: (item: TItem) => boolean;
  items: readonly TItem[];
  slug: string;
}): TItem | null {
  const matches = items.filter((item) => item.slug === slug);
  return matches.find((item) => isHome(item)) ?? matches[0] ?? null;
}

/**
 * Finds the chapter a public URL points to in a course outline, with its
 * number across every level band ("Chapter 2 of 6").
 */
export function findOutlineChapter<TChapter extends OutlineChapter>({
  chapterSlug,
  courseId,
  levels,
}: {
  chapterSlug: string;
  courseId: string;
  levels: readonly { chapters: readonly TChapter[] }[];
}): { chapter: TChapter; number: number; total: number } | null {
  const chapters = levels.flatMap((band) => band.chapters);

  const chapter = pickBySlug({
    isHome: (item) => item.homeCourseId === courseId,
    items: chapters,
    slug: chapterSlug,
  });

  if (!chapter) {
    return null;
  }

  return { chapter, number: chapters.indexOf(chapter) + 1, total: chapters.length };
}

/** Finds the lesson a public URL points to in a chapter, preferring the chapter's own lesson. */
export function findOutlineLesson<TLesson extends OutlineLesson>({
  chapterId,
  lessonSlug,
  lessons,
}: {
  chapterId: string;
  lessonSlug: string;
  lessons: readonly TLesson[];
}): TLesson | null {
  return pickBySlug({
    isHome: (item) => item.homeChapterId === chapterId,
    items: lessons,
    slug: lessonSlug,
  });
}
