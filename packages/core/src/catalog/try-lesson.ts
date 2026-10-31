import "server-only";
import { type PublicFirstScreen } from "../library/lessons/_utils/public-first-screen";
import { getPublicLibraryLesson } from "../library/lessons/get-public-library-lesson";
import { getCatalogChapterPlacement } from "./_utils/catalog-chapter";
import { getCatalogCourse } from "./_utils/catalog-course";

type FirstChoiceScreen = Extract<PublicFirstScreen, { kind: "choice" }>;

type TryLessonCandidate = { chapterTitle: string; lessonId: string; number: number };

export type TryLessonPick = TryLessonCandidate & { minutes: number; screen: FirstChoiceScreen };

type OutlineChapter = { lessons: readonly { id: string }[]; title: string };

const CANDIDATES = 8;

/**
 * A lesson that opens with a guess, else one that opens with a question, among the first lessons of
 * `chapters` in order. Each lesson's read is cached, so a page can look before it decides to show it.
 */
export async function pickTryLesson(
  chapters: readonly OutlineChapter[],
): Promise<TryLessonPick | null> {
  const candidates = chapters
    .flatMap((chapter) =>
      chapter.lessons.map((lesson, index) => ({
        chapterTitle: chapter.title,
        lessonId: lesson.id,
        number: index + 1,
      })),
    )
    .slice(0, CANDIDATES);

  const lessons = await Promise.all(
    candidates.map(async (candidate) => {
      const lesson = await getPublicLibraryLesson({ lessonId: candidate.lessonId });
      const screen = lesson?.firstScreen;

      return lesson && screen?.kind === "choice"
        ? { ...candidate, minutes: lesson.estimatedMinutes, screen }
        : null;
    }),
  );

  const questions = lessons.filter((item) => item !== null);
  return questions.find((item) => item.screen.guess) ?? questions[0] ?? null;
}

export async function getCourseTryLesson({ courseId }: { courseId: string }) {
  const catalog = await getCatalogCourse(courseId);
  return catalog ? pickTryLesson(catalog.placements.map((placement) => placement.chapter)) : null;
}

export async function getChapterTryLesson(input: { chapterId: string; courseId?: string }) {
  const found = await getCatalogChapterPlacement(input);
  return found ? pickTryLesson([found.chapter]) : null;
}
