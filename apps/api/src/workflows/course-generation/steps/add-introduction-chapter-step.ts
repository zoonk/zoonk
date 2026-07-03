import { createStepStream } from "@/workflows/_shared/stream-status";
import { type CourseIntroductionSchema } from "@zoonk/ai/tasks/courses/introduction";
import { type CourseWorkflowStepName } from "@zoonk/core/workflows/steps";
import { type Chapter, prisma } from "@zoonk/db";
import { normalizeString, toSlug } from "@zoonk/utils/string";
import { type CourseContext } from "./initialize-course-step";

type IntroductionChapterPlan = CourseIntroductionSchema["chapter"];

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
  const existingChapter = await prisma.chapter.findFirst({
    orderBy: { position: "asc" },
    where: { courseId: course.courseId, position: 0 },
  });

  if (existingChapter) {
    return existingChapter;
  }

  return prisma.chapter.create({
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
