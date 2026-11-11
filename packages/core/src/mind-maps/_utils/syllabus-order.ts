import { type ChapterNumbering } from "../../view-models/syllabus/_utils/chapter-numbers";

type Numbered<T> = { chapter: T; number: ReturnType<ChapterNumbering> };

/** As the syllabus numbers chapters, each subject's or the course's by number; the rest last. */
function toSyllabusPlace({ chapter, number }: Numbered<{ position: number }>): [number, number] {
  return number.syllabusOrder === null
    ? [Number.MAX_SAFE_INTEGER, chapter.position]
    : [number.syllabusOrder, number.position];
}

function compareBySyllabus(
  first: Numbered<{ position: number }>,
  second: Numbered<{ position: number }>,
): number {
  const [firstSubject, firstChapter] = toSyllabusPlace(first);
  const [secondSubject, secondChapter] = toSyllabusPlace(second);

  return firstSubject - secondSubject || firstChapter - secondChapter;
}

/** The scope's chapters in the order the Mind maps page lists them, with their numbers. */
export function sortBySyllabus<T extends { chapterId: string; position: number }>({
  chapters,
  numbering,
}: {
  chapters: readonly T[];
  numbering: ChapterNumbering;
}): Numbered<T>[] {
  return chapters
    .map((chapter) => ({
      chapter,
      number: numbering({ chapterId: chapter.chapterId, planPosition: chapter.position }),
    }))
    .toSorted(compareBySyllabus);
}
