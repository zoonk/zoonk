import "server-only";
import { type Chapter, type CourseLearningPlan, type Lesson, prisma } from "@zoonk/db";
import { cacheTag } from "next/cache";
import { getCourseCurriculumCacheTag, getUserProgressCacheTag } from "../../cache/tags";
import {
  getCourseBrandSlug,
  isGeneratedCourse,
  supportsCourseLearningPlan,
} from "../course-access";
import {
  CURRENT_CURRICULUM_VERSION,
  type CoursePlanInput,
  coursePlanInputSchema,
} from "../learning-plan-contract";
import { type loadContext, loadContexts } from "./course-learning-plan-context";
import {
  defaultChapterIds,
  getInputError,
  hasEmptyTeachingSelection,
  planPreferences,
  requiredLessons,
} from "./course-learning-plan-rules";

export type LearningPathChapter = Chapter & {
  lessons: (Lesson & { isCompleted: boolean })[];
  completedLessons: number;
  totalLessons: number;
  isCompleted: boolean;
};

export type CourseLearningTarget = {
  brandSlug: string;
  courseId: string;
  courseSlug: string;
  chapterId: string;
  chapterSlug: string;
  lessonId?: string;
  lessonSlug?: string;
  generationStatus: "pending" | "running" | "completed" | "failed";
};

function getSavedOrDefaultPreferences(
  course: { format: string; curriculumVersion: number },
  plan: CourseLearningPlan | null,
): CoursePlanInput {
  if (plan) {
    return planPreferences(plan);
  }

  const hasOverview =
    !["language", "question", "personalized"].includes(course.format) &&
    course.curriculumVersion >= CURRENT_CURRICULUM_VERSION;

  return { depth: hasOverview ? "overview" : "complete" };
}

function needsExplicitPathStart({
  preferences,
  needsCurriculumUpdate,
  plan,
  contentRevision,
}: {
  preferences?: CoursePlanInput;
  needsCurriculumUpdate: boolean;
  plan: CourseLearningPlan | null;
  contentRevision: number;
}) {
  if (preferences) {
    return needsCurriculumUpdate;
  }

  return plan?.depth === "focused" && plan.contentRevision !== contentRevision;
}

export async function readCourseLearningPaths({
  courseIds,
  preferences,
}: {
  courseIds: string[];
  preferences?: CoursePlanInput;
}) {
  "use cache: private";
  courseIds.forEach((courseId) => cacheTag(getCourseCurriculumCacheTag(courseId)));
  const contexts = await loadContexts(courseIds);
  const userId = contexts[0]?.userId;

  if (userId) {
    cacheTag(getUserProgressCacheTag(userId));
  }

  const completed = userId
    ? await prisma.lessonProgress.findMany({
        where: {
          completedAt: { not: null },
          lesson: { chapter: { courseId: { in: contexts.map(({ course }) => course.id) } } },
          userId,
        },
      })
    : [];

  const completedIds = new Set(completed.flatMap((row) => (row.lessonId ? [row.lessonId] : [])));
  const byCourse = new Map(contexts.map((context) => [context.course.id, context]));

  return courseIds.map((courseId) => {
    const context = byCourse.get(courseId);

    return context
      ? buildLearningPath({ completedIds, context, preferences })
      : { status: "notFound" as const };
  });
}

function buildLearningPath({
  context,
  preferences,
  completedIds,
}: {
  context: NonNullable<Awaited<ReturnType<typeof loadContext>>>;
  preferences?: CoursePlanInput;
  completedIds: Set<string>;
}) {
  const { course } = context;
  const supportsLearningPlan = supportsCourseLearningPlan(course);
  const plan = supportsLearningPlan ? context.plan : null;

  const parsed = coursePlanInputSchema.safeParse(
    preferences ?? getSavedOrDefaultPreferences(course, plan),
  );

  if (
    (!supportsLearningPlan && preferences) ||
    !parsed.success ||
    getInputError(course.format, parsed.data)
  ) {
    return { status: "invalid" as const };
  }

  const input = parsed.data;
  const canGenerate = isGeneratedCourse(course);

  const needsCurriculumUpdate =
    canGenerate && course.curriculumVersion < CURRENT_CURRICULUM_VERSION;

  const canUseSavedPlan =
    !preferences && plan !== null && plan.contentRevision === course.contentRevision;

  const chapterIds = canUseSavedPlan
    ? plan.chapterIds
    : defaultChapterIds({ chapters: course.chapters, format: course.format, preferences: input });

  const selected = chapterIds.flatMap((id) =>
    course.chapters.filter((chapter) => chapter.id === id),
  );

  if (
    hasEmptyTeachingSelection({ chapters: selected, format: course.format, preferences: input })
  ) {
    return { status: "invalid" as const };
  }

  const visibleChapters = selected.filter(
    (chapter) =>
      chapter.lessons.length === 0 ||
      requiredLessons({ format: course.format, lessons: chapter.lessons, preferences: input })
        .length > 0,
  );

  const chapters: LearningPathChapter[] = visibleChapters.map((chapter) => {
    const lessons = requiredLessons({
      format: course.format,
      lessons: chapter.lessons,
      preferences: input,
    }).map((lesson) => ({ ...lesson, isCompleted: completedIds.has(lesson.id) }));

    const completedLessons = lessons.filter((lesson) => lesson.isCompleted).length;

    return {
      ...chapter,
      completedLessons,
      isCompleted: lessons.length > 0 && completedLessons === lessons.length,
      lessons,
      totalLessons: lessons.length,
    };
  });

  const isNextLesson = (lesson: LearningPathChapter["lessons"][number]) =>
    !lesson.isCompleted && (canGenerate || lesson.generationStatus === "completed");

  const nextChapter = chapters.find((chapter) =>
    canGenerate ? !chapter.isCompleted : chapter.lessons.some(isNextLesson),
  );

  const nextLesson = nextChapter?.lessons.find(isNextLesson);

  const nextTarget: CourseLearningTarget | null = nextChapter
    ? {
        brandSlug: getCourseBrandSlug(course),
        chapterId: nextChapter.id,
        chapterSlug: nextChapter.slug,
        courseId: course.id,
        courseSlug: course.slug,
        generationStatus: nextLesson?.generationStatus ?? nextChapter.generationStatus,
        ...(nextLesson ? { lessonId: nextLesson.id, lessonSlug: nextLesson.slug } : {}),
      }
    : null;

  return {
    chapters,
    needsCurriculumUpdate,
    needsPlan: supportsLearningPlan && (!plan || plan.contentRevision !== course.contentRevision),
    nextTarget: needsExplicitPathStart({
      contentRevision: course.contentRevision,
      needsCurriculumUpdate,
      plan,
      preferences,
    })
      ? null
      : nextTarget,
    plan,
    progress: {
      completedChapters: chapters.filter((chapter) => chapter.isCompleted).length,
      completedLessons: chapters.reduce((total, chapter) => total + chapter.completedLessons, 0),
      totalChapters: chapters.length,
      totalLessons: chapters.reduce((total, chapter) => total + chapter.totalLessons, 0),
    },
    status: "ready" as const,
    supportsLearningPlan,
  };
}
