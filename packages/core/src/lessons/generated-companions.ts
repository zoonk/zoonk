import { type Lesson, prisma } from "@zoonk/db";
import {
  getGeneratedCompanionSourceKind,
  getGeneratedCompanionTargetKind,
} from "./generated-companion-kinds";

export { isGeneratedCompanionLessonKind } from "./generated-companion-kinds";

type LessonCompanionReference = { chapterId: string; lessonId: string };

/**
 * Loads the ordered rows used for pairing in one database statement. A single
 * statement sees one consistent chapter snapshot even if a split transaction
 * commits concurrently, so positions can never come from different versions.
 */
async function getChapterCompanionLinks(chapterId: string): Promise<Lesson[]> {
  return prisma.lesson.findMany({ orderBy: { position: "asc" }, where: { chapterId } });
}

/**
 * Returns the position of a stable lesson ID inside the snapshot. The ID, not a
 * previously loaded position, anchors every source/companion lookup.
 */
function getLessonIndex({
  lessonId,
  lessons,
}: {
  lessonId: string;
  lessons: Lesson[];
}): number | null {
  const index = lessons.findIndex((lesson) => lesson.id === lessonId);
  return index === -1 ? null : index;
}

/**
 * Finds the nearest earlier source of the required kind in one ordered chapter
 * snapshot. Generated companion rows always follow the source that owns them.
 */
function findPreviousSource({
  beforeIndex,
  lessons,
  sourceKind,
}: {
  beforeIndex: number;
  lessons: Lesson[];
  sourceKind: Lesson["kind"];
}): Lesson | null {
  return lessons.slice(0, beforeIndex).findLast((lesson) => lesson.kind === sourceKind) ?? null;
}

/**
 * Finds the first target before the next source of the same kind. This keeps
 * adjacent vocabulary/translation and reading/listening pairs independent.
 */
function findNextCompanion({
  afterIndex,
  lessons,
  sourceKind,
  targetKind,
}: {
  afterIndex: number;
  lessons: Lesson[];
  sourceKind: Lesson["kind"];
  targetKind: Lesson["kind"];
}): Lesson | null {
  const candidates = lessons.slice(afterIndex + 1);
  const nextSourceIndex = candidates.findIndex((lesson) => lesson.kind === sourceKind);

  const boundedCandidates =
    nextSourceIndex === -1 ? candidates : candidates.slice(0, nextSourceIndex);

  return boundedCandidates.find((lesson) => lesson.kind === targetKind) ?? null;
}

/**
 * Applies the shared source-to-companion rule to one ordered chapter snapshot.
 * Persistence can call this while holding the chapter-order lock, and readers
 * use the same rule after loading their own single-statement snapshot.
 */
export function findGeneratedCompanionForSourceLesson({
  lessonId,
  lessons,
}: {
  lessonId: string;
  lessons: Lesson[];
}): Lesson | null {
  const lessonIndex = getLessonIndex({ lessonId, lessons });
  const lesson = lessonIndex === null ? null : lessons[lessonIndex];
  const targetKind = lesson ? getGeneratedCompanionTargetKind(lesson.kind) : null;

  if (!lesson || lessonIndex === null || !targetKind) {
    return null;
  }

  return findNextCompanion({
    afterIndex: lessonIndex,
    lessons,
    sourceKind: lesson.kind,
    targetKind,
  });
}

/**
 * Finds the source lesson that owns a generated companion row. The source does
 * not need completed content; callers use this to route learners to the lesson
 * generation page that can create the missing companion content.
 */
export async function getSourceLessonForGeneratedCompanion({
  chapterId,
  lessonId,
}: LessonCompanionReference): Promise<Lesson | null> {
  const lessons = await getChapterCompanionLinks(chapterId);
  const lessonIndex = getLessonIndex({ lessonId, lessons });
  const lesson = lessonIndex === null ? null : lessons[lessonIndex];
  const sourceKind = lesson ? getGeneratedCompanionSourceKind(lesson.kind) : null;

  if (!lesson || lessonIndex === null || !sourceKind) {
    return null;
  }

  return findPreviousSource({ beforeIndex: lessonIndex, lessons, sourceKind });
}

/**
 * Finds the companion row owned by a source lesson from the same ordered
 * snapshot that located the stable source ID.
 */
export async function getGeneratedCompanionForSourceLesson({
  chapterId,
  lessonId,
}: LessonCompanionReference): Promise<Lesson | null> {
  const lessons = await getChapterCompanionLinks(chapterId);

  return findGeneratedCompanionForSourceLesson({ lessonId, lessons });
}
