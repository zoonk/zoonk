import "server-only";
import { RATE_LIMIT_RULES } from "@zoonk/auth/rate-limit";
import { type LibraryVisibility, prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { cacheTag } from "next/cache";
import { getLibraryLessonCacheTag, getMediaAssetCacheTag } from "../cache/tags";
import { isActorRateLimited } from "../entitlements/_utils/actor-rate-limit";
import { RATE_LIMIT_RETRY_SECONDS } from "../entitlements/limits";
import { canViewLibraryRow } from "../library/_utils/library-visibility";
import { toSummaryIdeas } from "../library/lessons/_utils/summary-ideas";
import { getSession } from "../users/get-session";
import { loadDepthVersions, withDepthVersions } from "./_utils/depth-versions";
import { withLearnerLessonVersions } from "./_utils/learner-lesson-versions";
import { playableStepInclude } from "./_utils/lesson-rows";
import { loadPlayableSteps } from "./_utils/load-playable-steps";
import { type PlayableLibraryLesson } from "./contract";

/** A lesson whose content isn't written yet: what the waiting page shows about it. */
type LessonOutline = Pick<
  PlayableLibraryLesson,
  "description" | "estimatedMinutes" | "id" | "language" | "title"
>;

export type PlayableLibraryLessonResult =
  | { lesson: PlayableLibraryLesson; status: "ready" }
  | { lesson: LessonOutline; status: "notGenerated" }
  /** Written, but its screens load only with a session (a guest's is enough), so they can't be scraped. */
  | { lesson: LessonOutline; status: "sessionRequired" }
  /** This learner (or a guest's network) read a lot of lessons' screens in a short time. */
  | { lesson: LessonOutline; retryAfterSeconds: number; status: "slowDown" };

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
      steps: { include: playableStepInclude, orderBy: { position: "asc" } },
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

async function getCachedPlayableLesson(lessonId: string): Promise<LoadedPlayableLesson | null> {
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

/**
 * Each app keeps its own cache, and the API's workflows write lessons that main waits on, so a
 * cached "not written yet" is never trusted: it's read again from the database, which is cheap
 * for an unwritten lesson. Written lessons are served from the cache.
 */
async function getWrittenOrFreshPlayableLesson(
  lessonId: string,
): Promise<LoadedPlayableLesson | null> {
  const cached = await getCachedPlayableLesson(lessonId);

  if (cached?.result.status !== "notGenerated") {
    return cached;
  }

  const lesson = await findPlayableLessonRow(lessonId);
  return lesson ? toLoadedPlayableLesson(lesson) : null;
}

function toOutline(lesson: PlayableLibraryLesson): LessonOutline {
  const { description, estimatedMinutes, id, language, title } = lesson;
  return { description, estimatedMinutes, id, language, title };
}

/**
 * A Library lesson's title and description for the player's page metadata, without its screens,
 * so naming the page never counts as reading the lesson. Null when it doesn't exist or isn't the
 * viewer's to see.
 */
export async function getLibraryLessonOutline({
  lessonId,
}: {
  lessonId: string;
}): Promise<LessonOutline | null> {
  if (!isUuid(lessonId)) {
    return null;
  }

  const cached = await getCachedPlayableLesson(lessonId.toLowerCase());

  if (!cached || !(await canViewLibraryRow(cached.access))) {
    return null;
  }

  return cached.result.status === "ready" ? toOutline(cached.result.lesson) : cached.result.lesson;
}

/**
 * The cached lesson as this learner plays it: with the "Simpler" and "Go deeper" versions made so
 * far, read fresh (see `loadDepthVersions`), and with their field or tool's versions.
 */
async function toPlayedLesson({
  lesson,
  userId,
}: {
  lesson: PlayableLibraryLesson;
  userId: string;
}): Promise<PlayableLibraryLesson> {
  const [versions, seen] = await Promise.all([
    loadDepthVersions(lesson.steps.map((step) => step.id)),
    withLearnerLessonVersions({ lesson, userId }),
  ]);

  return withDepthVersions({ lesson: seen, versions });
}

/**
 * Loads a Library lesson for the player: its screens in order with images and any "Simpler" or
 * "Go deeper" version already made, its skills and its home chapter. The content is the same for
 * every viewer and never includes provenance, so guests and signed-in learners share one cached
 * copy; depth versions, which learners add while they play, are read fresh on every load. A
 * private lesson is only returned to its owner. Screens go only to someone with a session,
 * a guest's included: visitors get the outline, like search engines on the public lesson page. A
 * learner gets the screens their field or tool has a version of in that version (see
 * `withLearnerLessonVersions`). Reading screens is rate-limited per learner, and per network for
 * guests (the `lesson-steps` Firewall rule), so no session can read every lesson; over the limit,
 * it returns the outline with `slowDown`. A lesson whose content isn't written yet returns its
 * outline, so the page can wait for it.
 */
export async function getPlayableLibraryLesson({
  lessonId,
}: {
  lessonId: string;
}): Promise<PlayableLibraryLessonResult | null> {
  if (!isUuid(lessonId)) {
    return null;
  }

  const [cached, session] = await Promise.all([
    getWrittenOrFreshPlayableLesson(lessonId.toLowerCase()),
    getSession(),
  ]);

  if (!cached || !(await canViewLibraryRow(cached.access))) {
    return null;
  }

  if (cached.result.status === "ready" && !session) {
    return { lesson: toOutline(cached.result.lesson), status: "sessionRequired" };
  }

  if (cached.result.status === "ready" && session) {
    const { lesson } = cached.result;

    const tooFast = await isActorRateLimited({
      isGuest: session.user.isAnonymous === true,
      rule: RATE_LIMIT_RULES.lessonSteps,
      userId: session.user.id,
    });

    if (tooFast) {
      return {
        lesson: toOutline(lesson),
        retryAfterSeconds: RATE_LIMIT_RETRY_SECONDS,
        status: "slowDown",
      };
    }

    return { lesson: await toPlayedLesson({ lesson, userId: session.user.id }), status: "ready" };
  }

  return cached.result;
}
