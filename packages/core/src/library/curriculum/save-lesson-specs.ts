import "server-only";
import { type LessonSpec } from "@zoonk/ai/tasks/lesson-spec/rules";
import { type CourseLevel, type TransactionClient, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { revalidateCourseContent } from "../../cache/revalidate-course-content";
import { getLibraryLessonCacheTag } from "../../cache/tags";
import { type LibraryProvenance } from "../_utils/library-rows";
import { lockPlanSourceWrite, writePlanInputs } from "../_utils/plan-input-write";
import { getChapterCacheTags, getLessonOutlineCacheTags } from "../chapters/chapter-cache-tags";
import { type IdentityCourse } from "../identity/_utils/identity-requests";
import { type CurriculumAnalytics, type CurriculumScope } from "./curriculum-scope";
import { resolveScopeLessons } from "./resolve-lesson-skills";

const POSITION_OFFSET = 1_000_000;

export type SavedLessonSpecs = { status: "notClaimed" } | { lessonIds: string[]; status: "saved" };

class SpecClaimLostError extends Error {
  override name = "SpecClaimLostError";
}

type SplitContext = {
  analytics?: CurriculumAnalytics;
  course: IdentityCourse | null;
  homeChapterId: string | null;
  level: CourseLevel;
  provenance: LibraryProvenance;
  scope: CurriculumScope;
  workflowRunId: string;
};

/**
 * A plan keeps when it was planned, so a one-time reset after a planner change can plan again only
 * the lessons planned before it.
 */
function toSpecData(spec: LessonSpec) {
  return {
    canDo: spec.canDo,
    estimatedMinutes: spec.estimatedMinutes,
    spec: { ...spec, plannedAt: new Date().toISOString() },
  };
}

async function saveSplitLessons({
  context,
  specs,
}: {
  context: SplitContext;
  specs: readonly LessonSpec[];
}): Promise<(string | null)[]> {
  return resolveScopeLessons({
    ...context,
    goalSkills: [],
    lessons: specs.map((spec) => ({
      ...toSpecData(spec),
      description: spec.description,
      skills: spec.skills.map((skill) => ({ description: skill.description, name: skill.name })),
      specRunId: context.workflowRunId,
      // The lesson's save completes it, only while its run still holds the lesson's claim.
      specStatus: "pending",
      title: spec.title,
    })),
  });
}

async function placeAfter({
  chapterId,
  lessonId,
  splitIds,
  tx,
}: {
  chapterId: string;
  lessonId: string;
  splitIds: readonly string[];
  tx: TransactionClient;
}): Promise<void> {
  const placements = await tx.chapterLesson.findMany({
    orderBy: { position: "asc" },
    select: { lessonId: true },
    where: { chapterId },
  });

  const current = placements
    .map((placement) => placement.lessonId)
    .filter((id) => !splitIds.includes(id));

  const index = current.indexOf(lessonId);
  const order = [...current.slice(0, index + 1), ...splitIds, ...current.slice(index + 1)];

  await tx.chapterLesson.updateMany({
    data: { position: { increment: POSITION_OFFSET } },
    where: { chapterId },
  });

  for (const [position, id] of order.entries()) {
    // oxlint-disable-next-line no-await-in-loop -- An interactive transaction uses one Postgres connection.
    await tx.chapterLesson.upsert({
      create: { chapterId, lessonId: id, position },
      update: { position },
      where: { chapterId_lessonId: { chapterId, lessonId: id } },
    });
  }
}

/** Internal workflow bridge: the caller must hold the lesson's spec claim. */
export async function saveLessonSpecs({
  analytics,
  homeChapterId,
  lessonId,
  provenance,
  scope,
  specs,
  workflowRunId,
}: Omit<SplitContext, "course" | "level"> & {
  lessonId: string;
  specs: readonly LessonSpec[];
}): Promise<SavedLessonSpecs> {
  const [first, ...splits] = specs;

  const lesson = await prisma.lesson.findUnique({
    select: {
      homeChapter: { select: { homeCourse: { select: { id: true, title: true } } } },
      level: true,
    },
    where: { id: lessonId },
  });

  if (!first || !lesson) {
    return { status: "notClaimed" };
  }

  const context = {
    analytics,
    course: lesson.homeChapter?.homeCourse ?? null,
    homeChapterId,
    level: lesson.level,
    provenance,
    scope,
    workflowRunId,
  };

  const splitIds = await saveSplitLessons({ context, specs: splits });

  const placedIds = [
    ...new Set(splitIds.filter((id): id is string => id !== null && id !== lessonId)),
  ];

  const splitChapterId = homeChapterId && placedIds.length > 0 ? homeChapterId : null;
  const claim = { id: lessonId, specRunId: workflowRunId, specStatus: "running" as const };

  const { error } = await safeAsync(() =>
    writePlanInputs(async (tx) => {
      if ((await tx.lesson.count({ where: claim })) === 0) {
        throw new SpecClaimLostError();
      }

      await lockPlanSourceWrite(tx, {
        chapterIds: splitChapterId ? [splitChapterId] : [],
        lessonIds: [lessonId, ...placedIds],
      });

      await tx.lesson.updateMany({
        data: { specStatus: "completed" },
        where: { id: { in: placedIds }, specRunId: workflowRunId, specStatus: "pending" },
      });

      if (splitChapterId) {
        await placeAfter({ chapterId: splitChapterId, lessonId, splitIds: placedIds, tx });
      }

      const updated = await tx.lesson.updateMany({
        data: { ...toSpecData(first), specStatus: "completed" },
        where: claim,
      });

      if (updated.count === 0) {
        throw new SpecClaimLostError();
      }
    }),
  );

  if (error instanceof SpecClaimLostError) {
    return { status: "notClaimed" };
  }

  if (error) {
    throw error;
  }

  await revalidateCourseContent([
    getLibraryLessonCacheTag(lessonId),
    ...(await getLessonOutlineCacheTags(lessonId)),
    ...(splitChapterId ? await getChapterCacheTags(splitChapterId) : []),
  ]);

  return { lessonIds: [lessonId, ...placedIds], status: "saved" };
}
