import { getPathname } from "@/i18n/navigation";
import { type SupportedLocale } from "@zoonk/utils/locale";

type ChapterHrefParams = { brandSlug: string; chapterSlug: string; courseSlug: string };

export function getChapterHref({ brandSlug, chapterSlug, courseSlug }: ChapterHrefParams) {
  return `/b/${brandSlug}/c/${courseSlug}/ch/${chapterSlug}` as const;
}

export function getLessonHref(params: ChapterHrefParams & { lessonSlug: string }) {
  return `${getChapterHref(params)}/l/${params.lessonSlug}` as const;
}

/**
 * The URL contract with onboarding (`/start`): `goal` holds the goal text
 * onboarding opens with. The home page's goal box sends what the visitor
 * typed after "I want to"; a course page sends the course's title.
 */
export const GOAL_PARAM = "goal";

export function getGoalStartHref(goal: string) {
  return `/start?${GOAL_PARAM}=${encodeURIComponent(goal)}` as const;
}

/**
 * Starting a course (or one of its chapters) as a goal: the page with its start button, where a
 * visitor without JavaScript lands and a shared link opens. `chapter` holds the chapter the plan
 * starts at. Opening it never creates anything; the button does.
 */
export const CHAPTER_PARAM = "chapter";

/**
 * `minutes` holds the time a day the course's example plan showed, which the plan starts with
 * (onboarding's schedule question opens on it).
 */
export const MINUTES_PARAM = "minutes";

const MIN_DAILY_MINUTES = 5;
const MAX_DAILY_MINUTES = 240;

/** The time a day the parameter holds, when it's one a plan can have. */
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

/**
 * Also part of the contract: `plan` holds the id of someone's plan whose link the visitor opened,
 * so onboarding starts their goal from that plan's structure.
 */
export const PLAN_PARAM = "plan";

export function getPlanLinkStartHref({ goal, planId }: { goal: string; planId: string }) {
  return `/start?${GOAL_PARAM}=${encodeURIComponent(goal)}&${PLAN_PARAM}=${planId}` as const;
}

/**
 * The URL contract with the lesson player (`/learn/[lessonId]`): a public page
 * sends the option the visitor picked on the lesson's first screen in this
 * search parameter, and the player opens with that answer chosen and checked,
 * so the tap on the public page counts as the first step of the lesson.
 */
export const FIRST_ANSWER_PARAM = "answer";

/**
 * Also part of the player's contract: `from` holds the catalog page (a course's, a chapter's or a
 * lesson's, without the language, and the place on it, such as its "Try a lesson" card) a visitor
 * opened the lesson from, so closing the lesson returns there instead of to an empty Today. Only a
 * catalog path is read back, so the parameter can't send anyone off the site.
 */
export const ORIGIN_PARAM = "from";

const CATALOG_PATH =
  /^\/b\/[^\s#/?]+\/c\/[^\s#/?]+(?:\/ch\/[^\s#/?]+(?:\/l\/[^\s#/?]+)?)?(?:#[\w-]+)?$/u;

/** The catalog page a lesson was opened from, when the parameter holds one. */
export function readCatalogOrigin(value: string | string[] | undefined): string | null {
  return typeof value === "string" && CATALOG_PATH.test(value) ? value : null;
}

/** A player link that remembers the catalog page it was opened from. */
export function withCatalogOrigin(href: string, origin: string): string {
  const separator = href.includes("?") ? "&" : "?";
  return `${href}${separator}${ORIGIN_PARAM}=${encodeURIComponent(origin)}`;
}

/** Where "Start" and first-screen answers go: the lesson player, in the page's language. */
export function getLessonPlayerPath({
  lessonId,
  locale,
}: {
  lessonId: string;
  locale: SupportedLocale;
}): string {
  return getPathname({ href: `/learn/${lessonId}`, locale });
}
