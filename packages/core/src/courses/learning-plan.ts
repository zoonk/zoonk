import "server-only";
import { generateCoursePath } from "@zoonk/ai/tasks/courses/path";
import { type Chapter, type CourseLearningPlan, prisma } from "@zoonk/db";
import { revalidateTag } from "next/cache";
import {
  COURSE_LIST_CACHE_TAG,
  getCourseCurriculumCacheTag,
  getUserProgressCacheTag,
} from "../cache/tags";
import { getSession } from "../users/get-session";
import { enrollUserInCourse } from "../workflows/internal/enroll-user-in-course";
import { readCourseLearningPaths } from "./_utils/course-learning-path";
import { loadContext } from "./_utils/course-learning-plan-context";
import {
  defaultChapterIds,
  getInputError,
  hasEmptyTeachingSelection,
  planPreferences,
} from "./_utils/course-learning-plan-rules";
import { claimLearningRequestQuota } from "./_utils/learning-request-quota";
import {
  getReadableCourseWhere,
  isGeneratedCourse,
  supportsCourseLearningPlan,
} from "./course-access";
import {
  CURRENT_CURRICULUM_VERSION,
  type CoursePlanInput,
  coursePlanInputSchema,
} from "./learning-plan-contract";

export type { CourseLearningTarget, LearningPathChapter } from "./_utils/course-learning-path";

export async function getCurrentUserCoursePlan({ courseId }: { courseId: string }) {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" as const };
  }

  const course = await prisma.course.findFirst({
    where: { ...getReadableCourseWhere(session.user.id), id: courseId },
  });

  if (!course) {
    return { status: "notFound" as const };
  }

  const plan = await prisma.courseLearningPlan.findUnique({
    where: { userCoursePlan: { courseId, userId: session.user.id } },
  });

  return { plan, status: "ready" as const };
}

/** Reads a saved course path or a guest preview without generating content. */
export async function getCourseLearningPath(input: {
  courseId: string;
  preferences?: CoursePlanInput;
}) {
  const paths = await readCourseLearningPaths({
    courseIds: [input.courseId],
    preferences: input.preferences,
  });

  return paths[0] ?? { status: "notFound" as const };
}

/** Batches selected paths for one authenticated learner's Track collection. */
export async function getCourseLearningPaths(input: {
  courseIds: string[];
  preferences?: CoursePlanInput;
}) {
  return readCourseLearningPaths(input);
}

function validateSelectedChapterOrder(chapterIds: string[], chapters: Chapter[]) {
  const positions = new Map(chapterIds.map((id, index) => [id, index]));

  const hasReversedPrerequisite = chapters.some((chapter) => {
    const position = positions.get(chapter.id);

    return (
      position !== undefined &&
      chapter.prerequisiteIds.some((id) => (positions.get(id) ?? -1) > position)
    );
  });

  if (hasReversedPrerequisite) {
    throw new Error("The selected path places a prerequisite after its dependent chapter");
  }
}

async function selectChapters({
  course,
  input,
  plan,
}: {
  course: NonNullable<Awaited<ReturnType<typeof loadContext>>>["course"];
  input: CoursePlanInput;
  plan: CourseLearningPlan | null;
}) {
  if (
    plan &&
    plan.contentRevision === course.contentRevision &&
    plan.depth === input.depth &&
    plan.goal === (input.goal ?? null) &&
    plan.startingKnowledge === (input.startingKnowledge ?? null) &&
    plan.startingLevel === (input.startingLevel ?? null)
  ) {
    return { chapterIds: plan.chapterIds, status: "ready" as const, summary: plan.summary };
  }

  if (
    input.depth !== "focused" ||
    !input.goal ||
    course.curriculumVersion < CURRENT_CURRICULUM_VERSION
  ) {
    return {
      chapterIds: defaultChapterIds({
        chapters: course.chapters,
        format: course.format,
        preferences: input,
      }),
      status: "ready" as const,
      summary: null,
    };
  }

  const quota = await claimLearningRequestQuota();

  if (quota.status !== "ready") {
    return quota;
  }

  const result = await generateCoursePath({
    chapters: course.chapters.map((chapter) => ({
      description: chapter.description,
      id: chapter.id,
      level: chapter.level,
      outcomes: chapter.outcomes,
      prerequisiteIds: chapter.prerequisiteIds,
      title: chapter.title,
    })),
    courseTitle: course.title,
    depth: input.depth,
    goal: input.goal,
    language: course.language,
    selectedLevel: input.startingLevel ?? null,
    startingKnowledge: input.startingKnowledge ?? "",
  });

  const available = new Set(course.chapters.map((chapter) => chapter.id));

  if (result.data.chapterIds.some((id) => !available.has(id))) {
    throw new Error("The generated path references unavailable chapters");
  }

  validateSelectedChapterOrder(result.data.chapterIds, course.chapters);

  return {
    chapterIds: result.data.chapterIds,
    status: "ready" as const,
    summary: result.data.summary,
  };
}

export async function updateCurrentUserCoursePlan({
  courseId,
  expectedRevision,
  input,
}: {
  courseId: string;
  expectedRevision?: number;
  input: CoursePlanInput;
}) {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" as const };
  }

  const context = await loadContext(courseId);

  if (!context) {
    return { status: "notFound" as const };
  }

  const parsed = coursePlanInputSchema.safeParse(input);

  if (
    !supportsCourseLearningPlan(context.course) ||
    !parsed.success ||
    getInputError(context.course.format, parsed.data)
  ) {
    return { status: "invalid" as const };
  }

  if (expectedRevision !== undefined && (context.plan?.revision ?? 0) !== expectedRevision) {
    return { status: "conflict" as const };
  }

  const selection = await selectChapters({
    course: context.course,
    input: parsed.data,
    plan: context.plan,
  });

  if (selection.status !== "ready") {
    return selection;
  }

  if (
    hasEmptyTeachingSelection({
      chapters: context.course.chapters.filter((chapter) =>
        selection.chapterIds.includes(chapter.id),
      ),
      format: context.course.format,
      preferences: parsed.data,
    })
  ) {
    return { status: "invalid" as const };
  }

  const data = {
    chapterIds: selection.chapterIds,
    contentRevision: context.course.contentRevision,
    dailyMinutes: parsed.data.dailyMinutes ?? null,
    depth: parsed.data.depth,
    goal: parsed.data.goal ?? null,
    hiddenLessonKinds: [...new Set(parsed.data.hiddenLessonKinds)],
    startingKnowledge: parsed.data.startingKnowledge ?? null,
    startingLevel: parsed.data.startingLevel ?? null,
    summary: selection.summary,
  };

  const result = await prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw`SELECT id FROM courses WHERE id = ${courseId}::uuid FOR UPDATE`;
    const currentCourse = await transaction.course.findUnique({ where: { id: courseId } });

    const currentPlan = await transaction.courseLearningPlan.findUnique({
      where: { userCoursePlan: { courseId, userId: session.user.id } },
    });

    if (
      !currentCourse ||
      currentCourse.contentRevision !== context.course.contentRevision ||
      (currentPlan?.revision ?? 0) !== (context.plan?.revision ?? 0)
    ) {
      return { status: "conflict" as const };
    }

    const plan = await transaction.courseLearningPlan.upsert({
      create: { ...data, courseId, userId: session.user.id },
      update: { ...data, revision: { increment: 1 } },
      where: { userCoursePlan: { courseId, userId: session.user.id } },
    });

    return { plan, status: "ready" as const };
  });

  if (result.status === "ready") {
    revalidateTag(getUserProgressCacheTag(session.user.id), { expire: 0 });
    revalidateTag(getCourseCurriculumCacheTag(courseId), { expire: 0 });
  }

  return result;
}

/** Starting owns enrollment and plan intent; the adapter starts only the returned authenticated generation resource. */
export async function startCurrentUserCourse({
  courseId,
  input,
  expectedRevision,
}: {
  courseId: string;
  input?: CoursePlanInput;
  expectedRevision?: number;
}) {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" as const };
  }

  if (input) {
    const updated = await updateCurrentUserCoursePlan({ courseId, expectedRevision, input });

    if (updated.status !== "ready") {
      return updated;
    }
  }

  const context = await loadContext(courseId);

  if (!context) {
    return { status: "notFound" as const };
  }

  if (
    !input &&
    context.plan &&
    context.plan.contentRevision !== context.course.contentRevision &&
    context.course.curriculumVersion >= CURRENT_CURRICULUM_VERSION
  ) {
    const updated = await updateCurrentUserCoursePlan({
      courseId,
      expectedRevision: context.plan.revision,
      input: planPreferences(context.plan),
    });

    if (updated.status !== "ready") {
      return updated;
    }
  }

  await enrollUserInCourse({ courseId, userId: session.user.id });
  revalidateTag(COURSE_LIST_CACHE_TAG, { expire: 0 });

  if (
    isGeneratedCourse(context.course) &&
    ((input && context.course.curriculumVersion < CURRENT_CURRICULUM_VERSION) ||
      context.course.chapters.length === 0)
  ) {
    return {
      contentRevision: context.course.contentRevision,
      courseId,
      resource: "curriculum" as const,
      resourceId: courseId,
      status: "generationRequired" as const,
    };
  }

  return getCourseLearningPath({ courseId });
}
