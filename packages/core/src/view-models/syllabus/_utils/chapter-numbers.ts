import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { libraryRowsVisibleTo } from "../../../library/_utils/library-visibility";
import { hasSubjectPages } from "../subject-pages";
import { buildSyllabus } from "./build-syllabus";
import { readSyllabusInput } from "./read-syllabus-input";

/** A chapter's number as every screen gives it, and the subject (or module) whose page numbers it. */
type ChapterNumber = { position: number; subject: { key: string; name: string } | null };

/** A chapter's number, given its number in the plan for when no subject's page numbers it. */
export type ChapterNumbering = (chapter: {
  chapterId: string;
  planPosition: number;
}) => ChapterNumber;

/**
 * A course's chapters by their number in it, in the order its page lists them (level band, then
 * position). Empty without a course.
 */
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

/**
 * How the goal's chapters are numbered wherever a learner sees them. When its subjects have pages
 * (an exam's notice, or two or more modules), a chapter's number is its number in its subject as
 * that page lists it, with the subject (the first one that lists it). Otherwise it's its number in
 * the course the plan follows, as the course's page lists it, whatever order the plan teaches it
 * in; for a chapter of neither, its number in the plan.
 */
export async function loadChapterNumbering(goal: Goal): Promise<ChapterNumbering> {
  const [input, courseNumbers] = await Promise.all([
    readSyllabusInput(goal.userId, goal.id),
    loadCourseNumbers(goal),
  ]);

  const syllabus = input ? buildSyllabus(input) : null;

  const subjects =
    syllabus && hasSubjectPages({ goalKind: goal.kind, syllabus }) ? syllabus.subjects : [];

  const entries = subjects.flatMap((subject) =>
    subject.chapters.flatMap((chapter) =>
      chapter.chapterId
        ? [
            [
              chapter.chapterId,
              {
                position: chapter.position,
                subject: { key: subject.key, name: subject.shortName },
              },
            ] as const,
          ]
        : [],
    ),
  );

  const numbers = new Map(entries.toReversed());

  return ({ chapterId, planPosition }) =>
    numbers.get(chapterId) ?? {
      position: courseNumbers.get(chapterId) ?? planPosition,
      subject: null,
    };
}
