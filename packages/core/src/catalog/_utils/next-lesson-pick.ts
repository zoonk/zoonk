type PickChapter = { lessons: readonly { id: string }[] };
type LessonOf<TChapter extends PickChapter> = TChapter["lessons"][number];

export type NextLessonPick<TChapter extends PickChapter> =
  | { chapter: TChapter; kind: "chapter" }
  | {
      chapter: TChapter;
      completed: boolean;
      kind: "lesson";
      lesson: LessonOf<TChapter>;
      lessonPosition: number;
    };

function isOpen({
  chapter,
  finishedLessonIds,
}: {
  chapter: PickChapter;
  finishedLessonIds: ReadonlySet<string>;
}) {
  return (
    chapter.lessons.length === 0 ||
    chapter.lessons.some((lesson) => !finishedLessonIds.has(lesson.id))
  );
}

function pickReview<TChapter extends PickChapter>(
  chapters: readonly TChapter[],
): NextLessonPick<TChapter> | null {
  const chapter = chapters[0];
  const lesson = chapter?.lessons[0];

  return chapter && lesson
    ? { chapter, completed: true, kind: "lesson", lesson, lessonPosition: 0 }
    : null;
}

/**
 * Where a learner goes next in an outline: the first unfinished lesson in reading order. When the
 * next chapter's lessons aren't written yet, the chapter itself (opening it writes them). When
 * every lesson is finished, the first lesson again, marked completed, so the button reviews.
 * Null for an outline without chapters.
 */
export function pickNextLesson<TChapter extends PickChapter>({
  chapters,
  finishedLessonIds,
}: {
  chapters: readonly TChapter[];
  finishedLessonIds: ReadonlySet<string>;
}): NextLessonPick<TChapter> | null {
  const chapter = chapters.find((item) => isOpen({ chapter: item, finishedLessonIds }));

  if (!chapter) {
    return pickReview(chapters);
  }

  const lessonPosition = chapter.lessons.findIndex((lesson) => !finishedLessonIds.has(lesson.id));
  const lesson = chapter.lessons[lessonPosition];

  if (!lesson) {
    return { chapter, kind: "chapter" };
  }

  return { chapter, completed: false, kind: "lesson", lesson, lessonPosition };
}
