import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { libraryRowsVisibleTo } from "../../../library/_utils/library-visibility";
import { hasSubjectPages } from "../subject-pages";
import { buildSyllabus } from "./build-syllabus";
import { readSyllabusInput } from "./read-syllabus-input";

type ChapterNumber = {
  position: number;
  subject: { key: string; name: string } | null;
  /**
   * Where the numbering that set `position` sits in the syllabus: a subject's place, as subject
   * pages are ordered, with the course after every subject; null when only the plan numbers it.
   */
  syllabusOrder: number | null;
};

/** Falls back to planPosition when no subject or course numbers the chapter. */
export type ChapterNumbering = (chapter: {
  chapterId: string;
  planPosition: number;
}) => ChapterNumber;

async function loadCourseNumbers(goal: Goal): Promise<Map<string, number>> {
  if (!goal.primaryCourseId) {
    return new Map();
  }

  const placements = await prisma.courseChapter.findMany({
    orderBy: [{ level: "asc" }, { position: "asc" }],
    select: { chapterId: true },
    where: { chapter: libraryRowsVisibleTo(goal.userId), courseId: goal.primaryCourseId },
  });

  return new Map(placements.map((placement, index) => [placement.chapterId, index + 1]));
}

/** Prefer subject-page numbering, then course-page numbering, then plan order so every screen uses the same chapter number. */
export async function loadChapterNumbering(goal: Goal): Promise<ChapterNumbering> {
  const [input, courseNumbers] = await Promise.all([
    readSyllabusInput(goal.userId, goal.id),
    loadCourseNumbers(goal),
  ]);

  const syllabus = input ? buildSyllabus(input) : null;

  const subjects =
    syllabus && hasSubjectPages({ goalKind: goal.kind, syllabus }) ? syllabus.subjects : [];

  const entries = subjects.flatMap((subject, subjectOrder) =>
    subject.chapters.flatMap((chapter) =>
      chapter.chapterId
        ? [
            [
              chapter.chapterId,
              {
                position: chapter.position,
                subject: { key: subject.key, name: subject.shortName },
                syllabusOrder: subjectOrder,
              },
            ] as const,
          ]
        : [],
    ),
  );

  const numbers = new Map(entries.toReversed());

  return ({ chapterId, planPosition }) => {
    const courseNumber = courseNumbers.get(chapterId);

    return (
      numbers.get(chapterId) ??
      (courseNumber === undefined
        ? { position: planPosition, subject: null, syllabusOrder: null }
        : { position: courseNumber, subject: null, syllabusOrder: subjects.length })
    );
  };
}
