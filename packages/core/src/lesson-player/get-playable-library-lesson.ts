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
import { CURRENT_STEPS } from "../library/lessons/lesson-versions";
import { getSession } from "../users/get-session";
import { withLearnerLessonVersions } from "./_utils/learner-lesson-versions";
import { isLessonInLearnerPlan } from "./_utils/lesson-in-plan";
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

/**
 * One version of a lesson, shared by every viewer: the version is part of the cache key, so a
 * lesson that changed since gets a new entry instead of the cached one.
 */
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

/**
 * When a lesson last changed: its row (written, pulled for a fix, rewritten, a fixed version
 * published) and its current screens (a picture linked later). Null when the lesson doesn't exist.
 */
async function findLessonVersion(lessonId: string): Promise<string | null> {
  const [lesson, steps] = await Promise.all([
    prisma.lesson.findUnique({ select: { updatedAt: true }, where: { id: lessonId } }),
    prisma.step.aggregate({ _max: { updatedAt: true }, where: { lessonId, ...CURRENT_STEPS } }),
  ]);

  return lesson ? `${lesson.updatedAt.getTime()}:${steps._max.updatedAt?.getTime() ?? 0}` : null;
}

/**
 * The lesson as it is now. Each app keeps its own cache, and the API's workflows and the admin
 * write, pull and rewrite lessons that main serves, where their cache revalidation never reaches:
 * a cheap fresh read of the lesson's version picks the cached copy of that version, so a lesson
 * written, pulled for a fix or rewritten elsewhere is never served as it was.
 */
async function getCurrentPlayableLesson(lessonId: string): Promise<LoadedPlayableLesson | null> {
  const version = await findLessonVersion(lessonId);
  return version ? getCachedPlayableLesson({ lessonId, version }) : null;
}

/**
 * Whether this read goes over the learner's `lesson-steps` limit. Lessons of their own plans never
 * count, so they aren't checked (a check counts the read).
 */
async function isReadingTooFast({
  isGuest,
  lessonId,
  userId,
}: {
  isGuest: boolean;
  lessonId: string;
  userId: string;
}): Promise<boolean> {
  if (await isLessonInLearnerPlan({ lessonId, userId })) {
    return false;
  }

  return isActorRateLimited({ isGuest, rule: RATE_LIMIT_RULES.lessonSteps, userId });
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

/**
 * Loads a Library lesson for the player: its screens in order with images, its skills and its home
 * chapter. The content is the same for every viewer and never includes provenance, so guests and
 * signed-in learners share one cached copy. A private lesson is only returned to its owner.
 * Screens go only to someone with a session, a guest's included: visitors get the outline, like
 * search engines on the public lesson page. A learner gets the screens their field or tool has a
 * version of in that version (see `withLearnerLessonVersions`). Reading screens of lessons outside
 * the learner's plans is rate-limited per learner, and per network for guests (the `lesson-steps`
 * Firewall rule), so no session can read every lesson; over the limit, it returns the outline with
 * `slowDown`. Lessons of their own plans never count (`isLessonInLearnerPlan`), so the apps' lists
 * load written ones ahead freely. A lesson whose content isn't written yet returns its outline, so
 * the page can wait for it. Private cached, so a link that prefetches the lesson opens it at once.
 */
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
    const { lesson } = cached.result;

    const tooFast = await isReadingTooFast({
      isGuest: session.user.isAnonymous === true,
      lessonId: lesson.id,
      userId: session.user.id,
    });

    if (tooFast) {
      return {
        lesson: toOutline(lesson),
        retryAfterSeconds: RATE_LIMIT_RETRY_SECONDS,
        status: "slowDown",
      };
    }

    return {
      lesson: await withLearnerLessonVersions({ lesson, userId: session.user.id }),
      status: "ready",
    };
  }

  return cached.result;
}
