import "server-only";
import { type GenerationStatus, type Lesson, prisma } from "@zoonk/db";

type BlockingLessonGenerationPrerequisite = {
  generationStatus: GenerationStatus;
  lessonId: string;
  lessonSlug: string;
  lessonTitle: string | null;
};

type LessonGenerationPrerequisiteTarget = Pick<Lesson, "chapterId" | "kind" | "position">;

type LessonGenerationPrerequisiteKind = Extract<
  Lesson["kind"],
  "listening" | "practice" | "quiz" | "reading" | "translation"
>;

type SourceBoundaryLessonKind = Extract<Lesson["kind"], "practice" | "quiz" | "reading">;
type SourceLessonKind = Extract<Lesson["kind"], "alphabet" | "reading" | "vocabulary">;

const LESSON_GENERATION_PREREQUISITE_KINDS = new Set<Lesson["kind"]>([
  "listening",
  "practice",
  "quiz",
  "reading",
  "translation",
]);

/** Identifies lesson kinds that read generated content from earlier lessons. */
export function hasLessonGenerationPrerequisites(
  kind: Lesson["kind"],
): kind is LessonGenerationPrerequisiteKind {
  return LESSON_GENERATION_PREREQUISITE_KINDS.has(kind);
}

/**
 * Keeps prerequisite responses small and stable across each rule. The UI only
 * needs enough lesson data to link the learner to the missing generation page.
 */
function toBlockingPrerequisite(lesson: Lesson): BlockingLessonGenerationPrerequisite {
  return {
    generationStatus: lesson.generationStatus,
    lessonId: lesson.id,
    lessonSlug: lesson.slug,
    lessonTitle: lesson.title,
  };
}

/**
 * Previous assessment and reading lessons close the source range for the next
 * generated lesson of the same kind. Without this boundary, later lessons would
 * keep reusing source content that was already practiced, quizzed, or read.
 */
async function getPreviousBoundaryPosition({
  beforePosition,
  chapterId,
  kind,
}: {
  beforePosition: number;
  chapterId: string;
  kind: SourceBoundaryLessonKind;
}): Promise<number> {
  const previousLesson = await prisma.lesson.findFirst({
    orderBy: { position: "desc" },
    where: { chapterId, kind, position: { lt: beforePosition } },
  });

  return previousLesson?.position ?? -1;
}

/**
 * Finds the first source lesson that still needs generation inside a bounded
 * range. Linking to the earliest blocker gives the learner a clear next action
 * while keeping the lock derived from existing lesson state.
 */
async function getFirstIncompleteLessonInRange({
  afterPosition,
  beforePosition,
  chapterId,
  kind,
}: {
  afterPosition: number;
  beforePosition: number;
  chapterId: string;
  kind: Lesson["kind"];
}): Promise<BlockingLessonGenerationPrerequisite | null> {
  const lesson = await prisma.lesson.findFirst({
    orderBy: { position: "asc" },
    where: {
      chapterId,
      generationStatus: { not: "completed" },
      kind,
      position: { gt: afterPosition, lt: beforePosition },
    },
  });

  if (!lesson) {
    return null;
  }

  return toBlockingPrerequisite(lesson);
}

/**
 * Translation and listening copy content from the nearest source lesson before
 * them. Checking the nearest source, not the nearest completed source, prevents
 * generation from silently skipping a pending lesson and reusing older content.
 */
async function getNearestIncompleteSourceLesson({
  beforePosition,
  chapterId,
  kinds,
}: {
  beforePosition: number;
  chapterId: string;
  kinds: SourceLessonKind[];
}): Promise<BlockingLessonGenerationPrerequisite | null> {
  const lesson = await prisma.lesson.findFirst({
    orderBy: { position: "desc" },
    where: { chapterId, kind: { in: kinds }, position: { lt: beforePosition } },
  });

  if (!lesson || lesson.generationStatus === "completed") {
    return null;
  }

  return toBlockingPrerequisite(lesson);
}

/**
 * Checks whether a lesson is blocked by unfinished generated source lessons.
 * Practice/quiz read explanations, translation/listening copy the nearest
 * language source, and reading consumes vocabulary since the previous reading.
 */
export async function getBlockingLessonGenerationPrerequisite(
  lesson: LessonGenerationPrerequisiteTarget,
): Promise<BlockingLessonGenerationPrerequisite | null> {
  if (!hasLessonGenerationPrerequisites(lesson.kind)) {
    return null;
  }

  if (lesson.kind === "translation") {
    return getNearestIncompleteSourceLesson({
      beforePosition: lesson.position,
      chapterId: lesson.chapterId,
      kinds: ["alphabet", "vocabulary"],
    });
  }

  if (lesson.kind === "listening") {
    return getNearestIncompleteSourceLesson({
      beforePosition: lesson.position,
      chapterId: lesson.chapterId,
      kinds: ["reading"],
    });
  }

  const boundaryPosition = await getPreviousBoundaryPosition({
    beforePosition: lesson.position,
    chapterId: lesson.chapterId,
    kind: lesson.kind,
  });

  return getFirstIncompleteLessonInRange({
    afterPosition: boundaryPosition,
    beforePosition: lesson.position,
    chapterId: lesson.chapterId,
    kind: lesson.kind === "reading" ? "vocabulary" : "explanation",
  });
}
