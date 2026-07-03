import { createStepStream } from "@/workflows/_shared/stream-status";
import { type CourseIntroductionSchema } from "@zoonk/ai/tasks/courses/introduction";
import { type CourseWorkflowStepName } from "@zoonk/core/workflows/steps";
import { type Chapter, isPrismaUniqueConstraintError, prisma } from "@zoonk/db";
import { normalizeString, toSlug } from "@zoonk/utils/string";
import { type CourseContext } from "./initialize-course-step";

type IntroductionChapterPlan = CourseIntroductionSchema["chapter"];

/**
 * Loads the reserved intro shell by structural position. Regular courses use
 * chapter position zero as the fixed field-guide chapter, so retry recovery must
 * target that position instead of the generated title or slug.
 */
async function getExistingIntroductionChapter(courseId: string): Promise<Chapter | null> {
  return prisma.chapter.findFirst({
    orderBy: { position: "asc" },
    where: { courseId, position: 0 },
  });
}

/**
 * Treats a concurrent insert for the reserved intro position as a successful
 * retry. The unique constraint guarantees only one workflow can create that
 * shell, and the loser should continue with the row that already exists.
 */
async function getRecoveredIntroductionChapter({
  courseId,
  error,
}: {
  courseId: string;
  error: unknown;
}): Promise<Chapter> {
  if (!isPrismaUniqueConstraintError(error)) {
    throw error;
  }

  const existingChapter = await getExistingIntroductionChapter(courseId);

  if (!existingChapter) {
    throw error;
  }

  return existingChapter;
}

/**
 * Saves the intro shell and falls back to the existing row when a parallel
 * workflow attempt wins the database race for the reserved position.
 */
async function createIntroductionChapter({
  course,
  plan,
}: {
  course: CourseContext & { targetLanguage: null };
  plan: IntroductionChapterPlan;
}): Promise<Chapter> {
  try {
    return await prisma.chapter.create({
      data: {
        courseId: course.courseId,
        description: plan.description,
        generationStatus: "running",
        isPublished: true,
        language: course.language,
        normalizedTitle: normalizeString(plan.title),
        organizationId: course.organizationId,
        position: 0,
        slug: toSlug(plan.title),
        title: plan.title,
      },
    });
  } catch (error) {
    return getRecoveredIntroductionChapter({ courseId: course.courseId, error });
  }
}

/**
 * Reuses an existing first chapter when a retry resumes after the intro shell
 * was already saved. Otherwise it creates the chapter at position zero so the
 * rest of the generated curriculum can be appended after it.
 */
async function getOrCreateIntroductionChapter({
  course,
  plan,
}: {
  course: CourseContext & { targetLanguage: null };
  plan: IntroductionChapterPlan;
}): Promise<Chapter> {
  const existingChapter = await getExistingIntroductionChapter(course.courseId);

  if (existingChapter) {
    return existingChapter;
  }

  return createIntroductionChapter({ course, plan });
}

/**
 * Persists the generated introduction chapter before the full chapter outline
 * exists. The normal addChapters step remains responsible for the main
 * curriculum, while this step owns the fixed position-zero shell.
 */
export async function addIntroductionChapterStep({
  course,
  plan,
}: {
  course: CourseContext & { targetLanguage: null };
  plan: IntroductionChapterPlan;
}): Promise<Chapter> {
  "use step";

  await using stream = createStepStream<CourseWorkflowStepName>();
  await stream.status({ status: "started", step: "addIntroductionChapter" });

  const chapter = await getOrCreateIntroductionChapter({ course, plan });

  await stream.status({ status: "completed", step: "addIntroductionChapter" });

  return chapter;
}
