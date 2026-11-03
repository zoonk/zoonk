import { getPathname } from "@/i18n/navigation";
import { MAX_DAILY_MINUTES, MIN_DAILY_MINUTES } from "@zoonk/core/plans/daily-minutes";
import { type SupportedLocale } from "@zoonk/utils/locale";

type ChapterHrefParams = { brandSlug: string; chapterSlug: string; courseSlug: string };

export function getChapterHref({ brandSlug, chapterSlug, courseSlug }: ChapterHrefParams) {
  return `/b/${brandSlug}/c/${courseSlug}/ch/${chapterSlug}` as const;
}

export function getLessonHref(params: ChapterHrefParams & { lessonSlug: string }) {
  return `${getChapterHref(params)}/l/${params.lessonSlug}` as const;
}

/** The URL contract with onboarding (`/start`): the goal text it opens with. */
export const GOAL_PARAM = "goal";

export function getGoalStartHref(goal: string) {
  return `/start?${GOAL_PARAM}=${encodeURIComponent(goal)}` as const;
}

/** Opening the start page never creates anything; its button does. */
export const CHAPTER_PARAM = "chapter";

export const MINUTES_PARAM = "minutes";

export function readDailyMinutes(value: string | string[] | undefined): number | null {
  const minutes = typeof value === "string" && /^\d+$/u.test(value) ? Number(value) : null;

  return minutes !== null && minutes >= MIN_DAILY_MINUTES && minutes <= MAX_DAILY_MINUTES
    ? minutes
    : null;
}

export function getCourseStartHref({
  chapterId,
  courseId,
  minutes,
}: {
  chapterId?: string | null;
  courseId: string;
  minutes?: number | null;
}) {
  const query = new URLSearchParams();

  if (chapterId) {
    query.set(CHAPTER_PARAM, chapterId);
  }

  if (minutes) {
    query.set(MINUTES_PARAM, String(minutes));
  }

  const search = query.toString();

  return search
    ? (`/start/course/${courseId}?${search}` as const)
    : (`/start/course/${courseId}` as const);
}

export const PLAN_PARAM = "plan";

export function getPlanLinkStartHref({ goal, planId }: { goal: string; planId: string }) {
  return `/start?${GOAL_PARAM}=${encodeURIComponent(goal)}&${PLAN_PARAM}=${planId}` as const;
}

/** The player opens with this answer checked, so the tap on the public page counts as the lesson's first step. */
export const FIRST_ANSWER_PARAM = "answer";

/**
 * Only a catalog path or one of the app's own places is read back, so the parameter can't send
 * anyone off the site.
 */
export const ORIGIN_PARAM = "from";

const CATALOG_PATH =
  /^\/b\/[^\s#/?]+\/c\/[^\s#/?]+(?:\/ch\/[^\s#/?]+(?:\/l\/[^\s#/?]+)?)?(?:#[\w-]+)?$/u;

const APP_ORIGINS = ["/today", "/completed-lessons"] as const;

type AppOrigin = (typeof APP_ORIGINS)[number];

export type LessonOrigin = { kind: "app" | "catalog"; path: string };

function isAppOrigin(value: string): value is AppOrigin {
  return APP_ORIGINS.some((origin) => origin === value);
}

export function readLessonOrigin(value: string | string[] | undefined): LessonOrigin | null {
  if (typeof value !== "string") {
    return null;
  }

  if (isAppOrigin(value)) {
    return { kind: "app", path: value };
  }

  return CATALOG_PATH.test(value) ? { kind: "catalog", path: value } : null;
}

export function getLessonAgainHref({ lessonId, origin }: { lessonId: string; origin: AppOrigin }) {
  return withOrigin(`/learn/${lessonId}`, origin);
}

export function withOrigin(href: string, origin: string): string {
  const separator = href.includes("?") ? "&" : "?";
  return `${href}${separator}${ORIGIN_PARAM}=${encodeURIComponent(origin)}`;
}

export function getLessonPlayerPath({
  lessonId,
  locale,
}: {
  lessonId: string;
  locale: SupportedLocale;
}): string {
  return getPathname({ href: `/learn/${lessonId}`, locale });
}
