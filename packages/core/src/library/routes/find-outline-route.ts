type OutlineChapter = { homeCourseId: string | null; slug: string };
type OutlineLesson = { homeChapterId: string | null; slug: string };

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
