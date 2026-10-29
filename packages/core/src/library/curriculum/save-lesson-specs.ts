import "server-only";
import { type LessonSpec } from "@zoonk/ai/tasks/v2/lesson-spec/rules";
import { type CourseLevel, prisma } from "@zoonk/db";
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

function toSpecData(spec: LessonSpec) {
  return { canDo: spec.canDo, estimatedMinutes: spec.estimatedMinutes, spec };
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
      specStatus: "completed",
      title: spec.title,
    })),
  });
}

async function placeAfter({
  chapterId,
  lessonId,
  splitIds,
}: {
  chapterId: string;
  lessonId: string;
  splitIds: readonly string[];
}): Promise<void> {
  await writePlanInputs(async (tx) => {
    await lockPlanSourceWrite(tx, { chapterIds: [chapterId], lessonIds: splitIds });

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

    await Promise.all(
      order.map((id, position) =>
        tx.chapterLesson.upsert({
          create: { chapterId, lessonId: id, position },
          update: { position },
          where: { chapterId_lessonId: { chapterId, lessonId: id } },
        }),
      ),
    );
  });

  await revalidateCourseContent(await getChapterCacheTags(chapterId));
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

  if (homeChapterId && placedIds.length > 0) {
    await placeAfter({ chapterId: homeChapterId, lessonId, splitIds: placedIds });
  }

  const claim = { id: lessonId, specRunId: workflowRunId, specStatus: "running" as const };

  const { error } = await safeAsync(() =>
    writePlanInputs(async (tx) => {
      if ((await tx.lesson.count({ where: claim })) === 0) {
        throw new SpecClaimLostError();
      }

      await lockPlanSourceWrite(tx, { lessonIds: [lessonId] });

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
  ]);

  return { lessonIds: [lessonId, ...placedIds], status: "saved" };
}
