import "server-only";
import { type LibraryVisibility, prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { cacheTag } from "next/cache";
import { getLibraryLessonCacheTag, getMediaAssetCacheTag } from "../cache/tags";
import { filterSkippedSteps } from "../language/activities/language-activities";
import { loadSkippedActivities } from "../language/activities/skipped-activities";
import { canViewLibraryRow } from "../library/_utils/library-visibility";
import { toSummaryIdeas } from "../library/lessons/_utils/summary-ideas";
import { CURRENT_STEPS } from "../library/lessons/lesson-versions";
import { getSession } from "../users/get-session";
import { withLearnerLessonVersions } from "./_utils/learner-lesson-versions";
import { playableStepInclude } from "./_utils/lesson-rows";
import { loadPlayableSteps } from "./_utils/load-playable-steps";
import { type PlayableLibraryLesson } from "./playable-lesson";

type LessonOutline = Pick<
  PlayableLibraryLesson,
  "description" | "estimatedMinutes" | "id" | "language" | "title"
>;

export type PlayableLibraryLessonResult =
  | { lesson: PlayableLibraryLesson; status: "ready" }
  | { lesson: LessonOutline; status: "notGenerated" }
  /** A learner or guest session is required to receive screens. */
  | { lesson: LessonOutline; status: "sessionRequired" };

type LoadedPlayableLesson = {
  access: { ownerId: string | null; visibility: LibraryVisibility };
  result: PlayableLibraryLessonResult;
};

function findPlayableLessonRow(lessonId: string) {
  return prisma.lesson.findUnique({
    include: {
      homeChapter: { select: { id: true, title: true } },
      skills: {
        include: { skill: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" },
      },
      steps: { include: playableStepInclude, orderBy: { position: "asc" }, where: CURRENT_STEPS },
    },
    omit: { spec: true },
    where: { id: lessonId },
  });
}

type PlayableLessonRow = NonNullable<Awaited<ReturnType<typeof findPlayableLessonRow>>>;

async function toLoadedPlayableLesson(lesson: PlayableLessonRow): Promise<LoadedPlayableLesson> {
  const access = { ownerId: lesson.ownerId, visibility: lesson.visibility };

  const outline = {
    description: lesson.description,
    estimatedMinutes: lesson.estimatedMinutes,
    id: lesson.id,
    language: lesson.language,
    title: lesson.title,
  };

  const steps = await loadPlayableSteps({ lesson, rows: lesson.steps });

  if (lesson.contentStatus !== "completed" || steps.length === 0) {
    return { access, result: { lesson: outline, status: "notGenerated" } };
  }

  return {
    access,
    result: {
      lesson: {
        ...outline,
        canDo: lesson.canDo,
        chapter: lesson.homeChapter,
        level: lesson.level,
        skills: lesson.skills.map((item) => item.skill),
        steps,
        summaryIdeas: toSummaryIdeas(lesson.summary),
        targetLanguage: lesson.targetLanguage,
      },
      status: "ready",
    },
  };
}

async function getCachedPlayableLesson({
  lessonId,
}: {
  lessonId: string;
  version: string;
}): Promise<LoadedPlayableLesson | null> {
  "use cache";
  cacheTag(getLibraryLessonCacheTag(lessonId));

  const lesson = await findPlayableLessonRow(lessonId);

  if (!lesson) {
    return null;
  }

  cacheTag(
    ...lesson.steps.flatMap((step) =>
      step.mediaAssetId ? [getMediaAssetCacheTag(step.mediaAssetId)] : [],
    ),
  );

  return toLoadedPlayableLesson(lesson);
}

async function findLessonVersion(lessonId: string): Promise<string | null> {
  const [lesson, steps] = await Promise.all([
    prisma.lesson.findUnique({ select: { updatedAt: true }, where: { id: lessonId } }),
    prisma.step.aggregate({ _max: { updatedAt: true }, where: { lessonId, ...CURRENT_STEPS } }),
  ]);

  return lesson ? `${lesson.updatedAt.getTime()}:${steps._max.updatedAt?.getTime() ?? 0}` : null;
}

/** Each app has separate caches, so fresh version keys must detect publication changes made elsewhere. */
async function getCurrentPlayableLesson(lessonId: string): Promise<LoadedPlayableLesson | null> {
  const version = await findLessonVersion(lessonId);
  return version ? getCachedPlayableLesson({ lessonId, version }) : null;
}

function toOutline(lesson: PlayableLibraryLesson): LessonOutline {
  const { description, estimatedMinutes, id, language, title } = lesson;
  return { description, estimatedMinutes, id, language, title };
}

/** Returns no screens; null means absent or inaccessible to the viewer. */
export async function getLibraryLessonOutline({
  lessonId,
}: {
  lessonId: string;
}): Promise<LessonOutline | null> {
  "use cache: private";

  if (!isUuid(lessonId)) {
    return null;
  }

  const cached = await getCurrentPlayableLesson(lessonId.toLowerCase());

  if (!cached || !(await canViewLibraryRow(cached.access))) {
    return null;
  }

  return cached.result.status === "ready" ? toOutline(cached.result.lesson) : cached.result.lesson;
}

function loadLessonSkippedActivities({
  lesson,
  userId,
}: {
  lesson: PlayableLibraryLesson;
  userId: string;
}) {
  return lesson.targetLanguage
    ? loadSkippedActivities({ targetLanguage: lesson.targetLanguage, userId })
    : Promise.resolve([]);
}

/** Private lessons require ownership; screens require a learner or guest session. Visitors and unfinished lessons receive an outline. */
export async function getPlayableLibraryLesson({
  lessonId,
}: {
  lessonId: string;
}): Promise<PlayableLibraryLessonResult | null> {
  "use cache: private";

  if (!isUuid(lessonId)) {
    return null;
  }

  const [cached, session] = await Promise.all([
    getCurrentPlayableLesson(lessonId.toLowerCase()),
    getSession(),
  ]);

  if (!cached || !(await canViewLibraryRow(cached.access))) {
    return null;
  }

  if (cached.result.status === "ready" && !session) {
    return { lesson: toOutline(cached.result.lesson), status: "sessionRequired" };
  }

  if (cached.result.status === "ready" && session) {
    const [lesson, skippedActivities] = await Promise.all([
      withLearnerLessonVersions({ lesson: cached.result.lesson, userId: session.user.id }),
      loadLessonSkippedActivities({ lesson: cached.result.lesson, userId: session.user.id }),
    ]);

    return {
      lesson: {
        ...lesson,
        steps: filterSkippedSteps({ activities: skippedActivities, steps: lesson.steps }),
      },
      status: "ready",
    };
  }

  return cached.result;
}
