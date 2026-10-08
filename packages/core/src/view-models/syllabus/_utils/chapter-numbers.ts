import "server-only";
import { type Goal } from "@zoonk/db";
import { hasSubjectPages } from "../subject-pages";
import { buildSyllabus } from "./build-syllabus";
import { loadSyllabusInput } from "./load-syllabus";

/** A chapter's number as every screen gives it, and the subject (or module) whose page numbers it. */
type ChapterNumber = { position: number; subject: { key: string; name: string } | null };

/** A chapter's number, given its number in the plan for when no subject's page numbers it. */
export type ChapterNumbering = (chapter: {
  chapterId: string;
  planPosition: number;
}) => ChapterNumber;

/**
 * How the goal's chapters are numbered wherever a learner sees them. When its subjects have pages
 * (an exam's notice, or two or more modules), a chapter's number is its number in its subject as
 * that page lists it, with the subject (the first one that lists it). Otherwise, and for a chapter
 * no subject lists, it's the chapter's number in the plan.
 */
export async function loadChapterNumbering(goal: Goal): Promise<ChapterNumbering> {
  const input = await loadSyllabusInput(goal);
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
    numbers.get(chapterId) ?? { position: planPosition, subject: null };
}
