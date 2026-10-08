import "server-only";
import { type LessonSpec } from "@zoonk/ai/tasks/v2/lesson-spec/rules";
import { type CourseLevel, prisma } from "@zoonk/db";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getLibraryLessonCacheTag } from "../../cache/tags";
import { type LibraryProvenance } from "../_utils/library-rows";
import { getChapterCacheTags } from "../chapters/chapter-cache-tags";
import { type IdentityCourse } from "../identity/_utils/identity-requests";
import { type CurriculumAnalytics, type CurriculumScope } from "./curriculum-scope";
import { resolveScopeLessons } from "./resolve-lesson-skills";

/** Moves every placement out of the way first, so the new order never collides with the old one. */
const POSITION_OFFSET = 1_000_000;

export type SavedLessonSpecs = { status: "notClaimed" } | { lessonIds: string[]; status: "saved" };

type SplitContext = {
  analytics?: CurriculumAnalytics;
  /** The course of the lesson's home chapter, where split lessons are placed. */
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

/**
 * Each spec the split rule cut off becomes its own lesson: the specs' skills go through identity
 * search together, a lesson of the same course that already teaches them at this level is reused
 * (or another course's the reuse decision finds on the same subject), and a new one is created with
 * its spec, so it never needs planning again. Returns each spec's lesson, in order.
 */
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

/** Places split lessons right after the lesson they came from, keeping the rest of the order. */
async function placeAfter({
  chapterId,
  lessonId,
  splitIds,
}: {
  chapterId: string;
  lessonId: string;
  splitIds: readonly string[];
}): Promise<void> {
  await prisma.$transaction(async (tx) => {
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

  revalidateCacheTags(await getChapterCacheTags(chapterId));
}

/**
 * Stores a lesson's spec for the run that holds its spec claim and ends the claim. The spec keeps
 * the lesson's can-do line and minutes current. When the split rule cut the planned lesson into
 * several, the first part stays on this lesson and each other part becomes a lesson of its own,
 * placed right after it in the same chapter, so the plan picks the parts up in order. Returns the
 * ids of every lesson the specs now cover, this one first.
 *
 * This is a workflow bridge: Library content is shared and no learner's data is written.
 */
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

  const { count } = await prisma.lesson.updateMany({
    data: { ...toSpecData(first), specStatus: "completed" },
    where: { id: lessonId, specRunId: workflowRunId, specStatus: "running" },
  });

  if (count === 0) {
    return { status: "notClaimed" };
  }

  revalidateCacheTags([getLibraryLessonCacheTag(lessonId)]);

  return { lessonIds: [lessonId, ...placedIds], status: "saved" };
}
