import {
  type ExpandedChapterLesson,
  expandChapterLessons,
} from "@/workflows/chapter-generation/steps/_utils/lesson-plan-expansion";
import { addLessonsStep } from "@/workflows/chapter-generation/steps/add-lessons-step";
import { getChapterStep } from "@/workflows/chapter-generation/steps/get-chapter-step";
import { lessonGenerationWorkflow } from "@/workflows/lesson-generation/lesson-generation-workflow";
import { isStandaloneGeneratedLessonKind } from "@zoonk/core/lessons/generated-companion-kinds";
import { type Chapter, type Lesson } from "@zoonk/db";
import { addIntroductionChapterStep } from "../steps/add-introduction-chapter-step";
import { completeIntroductionChapterStep } from "../steps/complete-introduction-chapter-step";
import { completeIntroductionLessonStep } from "../steps/complete-introduction-lesson-step";
import { getIntroductionLessonsStep } from "../steps/get-introduction-lessons-step";
import { type CourseContext } from "../steps/initialize-course-step";
import { startIntroductionLessonsStep } from "../steps/start-introduction-lessons-step";

const INITIAL_LESSON_GENERATION_TARGET_COUNT = 3;

type IntroductionCourseContext = CourseContext & { targetLanguage: null };

/**
 * Keeps the intro chapter helper scoped to regular courses even if a future
 * caller bypasses the main workflow branch. Language courses already have a
 * specialized first chapter path, so generating this field-guide chapter for
 * them would create the wrong curriculum shape.
 */
function assertIntroductionCourseContext(
  course: CourseContext,
): asserts course is IntroductionCourseContext {
  if (course.targetLanguage) {
    throw new Error("Introduction chapters are only generated for regular courses.");
  }
}

/**
 * Converts intro lesson plans into the same row structure used by normal
 * content chapters. The intro chapter is a field guide, so it always receives
 * explanation companions instead of any language-course vocabulary expansion.
 */
function getIntroductionLessonRows({
  lessons,
}: {
  lessons: { description: string; title: string }[];
}): ExpandedChapterLesson[] {
  return expandChapterLessons({
    lessons: lessons.map((lesson) => ({ ...lesson, kind: "explanation" as const })),
    targetLanguage: null,
  });
}

/**
 * Reuses saved lesson rows on retry; otherwise saves the generated intro lesson
 * plan and marks the intro chapter complete. Chapter completion can happen
 * before lesson content generation because the rows themselves now exist.
 */
async function getOrCreateIntroductionLessons({
  chapter,
  lessons,
}: {
  chapter: Chapter;
  lessons: { description: string; title: string }[];
}): Promise<Lesson[]> {
  const context = await getChapterStep(chapter.id);

  if (context._count.lessons > 0) {
    await completeIntroductionChapterStep(chapter.id);
    return getIntroductionLessonsStep(chapter.id);
  }

  const createdLessons = await addLessonsStep({
    context,
    lessons: getIntroductionLessonRows({ lessons }),
  });

  await completeIntroductionChapterStep(chapter.id);

  return createdLessons;
}

/**
 * Picks the first standalone lesson workflows to warm. This mirrors regular
 * chapter generation while keeping derived rows such as review out of the
 * initial generation batch.
 */
function getInitialLessonGenerationTargets(lessons: Lesson[]): Lesson[] {
  return lessons
    .filter((lesson) => isStandaloneGeneratedLessonKind(lesson.kind))
    .slice(0, INITIAL_LESSON_GENERATION_TARGET_COUNT);
}

/**
 * Starts opportunistic warmups for intro lessons that should not block the
 * course redirect. Position zero is intentionally excluded because the course
 * generation page should keep streaming until that first lesson is ready.
 */
async function startRemainingIntroductionLessons(lessons: Lesson[]): Promise<void> {
  const [, ...remainingLessons] = getInitialLessonGenerationTargets(lessons);

  await startIntroductionLessonsStep({ lessons: remainingLessons });
}

/**
 * Generates the first intro lesson inline so its lesson-step events stay in the
 * parent course workflow stream. That gives the main app a real phase to show
 * and prevents the course from completing before the learner's first lesson is
 * actually ready.
 */
async function generateFirstIntroductionLesson(lessons: Lesson[]): Promise<void> {
  const [firstLesson] = getInitialLessonGenerationTargets(lessons);

  if (!firstLesson) {
    throw new Error("Introduction chapter did not create a first generated lesson.");
  }

  await lessonGenerationWorkflow(firstLesson.id);
  await completeIntroductionLessonStep({ lessonId: firstLesson.id });
}

/**
 * Makes the first intro lesson the readiness boundary while keeping the next
 * lesson warmups non-blocking. Starting the background workflows in parallel
 * with the first direct workflow preserves the old warmup behavior without
 * hiding position-zero generation in a separate stream.
 */
export async function generateIntroductionLessonContent(lessons: Lesson[]): Promise<void> {
  const [firstLessonResult] = await Promise.allSettled([
    generateFirstIntroductionLesson(lessons),
    startRemainingIntroductionLessons(lessons),
  ]);

  if (firstLessonResult.status === "rejected") {
    throw firstLessonResult.reason;
  }
}

/**
 * Persists the generated intro plan or reuses the saved intro chapter during
 * retry. This runs in the persistence phase so the generation pipeline can
 * produce the intro plan in parallel with the rest of the course setup.
 */
export async function persistIntroductionChapter({
  course,
  introduction,
}: {
  course: CourseContext;
  introduction: {
    chapter: { description: string; title: string };
    lessons: { description: string; title: string }[];
  };
}): Promise<{ chapter: Chapter; lessons: Lesson[] }> {
  assertIntroductionCourseContext(course);

  const chapter = await addIntroductionChapterStep({ course, plan: introduction.chapter });

  const lessons = await getOrCreateIntroductionLessons({ chapter, lessons: introduction.lessons });

  return { chapter, lessons };
}
