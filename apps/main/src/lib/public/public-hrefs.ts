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

export function getCourseStartHref({
  chapterId,
  courseId,
}: {
  chapterId?: string | null;
  courseId: string;
}) {
  return chapterId
    ? (`/start/course/${courseId}?${CHAPTER_PARAM}=${chapterId}` as const)
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
