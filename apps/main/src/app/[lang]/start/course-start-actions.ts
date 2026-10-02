"use server";

import { redirect } from "@/i18n/navigation";
import { startGoalWork } from "@/lib/goals/start-goal-work";
import { CHAPTER_PARAM, getCourseStartHref } from "@/lib/public/public-hrefs";
import { courseGoalStartInputSchema } from "@zoonk/core/goals/course-start-contract";
import { startCourseGoal } from "@zoonk/core/goals/start-course";
import { type GoalLimitReason } from "@zoonk/learn/onboarding/actions";
import { isUuid } from "@zoonk/utils/uuid";
import { getLocale } from "next-intl/server";
import { COURSE_START_ERROR_PARAM } from "./course/course-start-params";
import { getGoalLimitReason } from "./goal-limit-reason";

/**
 * Where starting a course leads: the goal's remaining onboarding (`steps`), or the learner's day
 * when it's their goal on that course already and onboarding is behind them. `signInRequired`
 * only happens without a session, which the button makes first.
 */
export type CourseStartOutcome =
  | { goalId: string; next: "steps" | "today"; status: "started" }
  | { reason: GoalLimitReason; status: "limitReached" }
  | { status: "failed" | "signInRequired" };

/**
 * Starts a Library course (or one of its chapters) as the learner's goal: the same capability as
 * `POST /v1/courses/{courseId}/goals`. A new goal's run then writes ahead what its plan needs;
 * a run that couldn't start shows on the steps with a retry. The learner's goal already on the
 * course starts nothing new.
 */
export async function startCourseAction({
  chapterId,
  courseId,
  timeZone,
}: {
  chapterId?: string | null;
  courseId: string;
  timeZone?: string;
}): Promise<CourseStartOutcome> {
  const input = courseGoalStartInputSchema.safeParse({
    chapterId: chapterId ?? undefined,
    timeZone,
  });

  if (!input.success || !isUuid(courseId)) {
    return { status: "failed" };
  }

  const result = await startCourseGoal({ courseId, input: input.data });

  switch (result.status) {
    case "created":
      await startGoalWork([result.goal], { research: false });
      return { goalId: result.goal.id, next: "steps", status: "started" };
    case "existing":
      return {
        goalId: result.goal.id,
        next: result.inOnboarding ? "steps" : "today",
        status: "started",
      };
    case "refused":
      return { reason: getGoalLimitReason(result.refusals[0]?.decision), status: "limitReached" };
    case "unauthorized":
      return { status: "signInRequired" };
    case "notFound":
      return { status: "failed" };
    default:
      return result satisfies never;
  }
}

/** A field of the start page's form, when it's there. */
function readField(formData: FormData, name: string): string | null {
  const value = formData.get(name);
  return typeof value === "string" && value ? value : null;
}

/** Where the start page's form goes after its start, when there's no JavaScript to show it. */
function getFormDestination({
  outcome,
  startHref,
}: {
  outcome: CourseStartOutcome;
  startHref: string;
}): string {
  switch (outcome.status) {
    case "started":
      return outcome.next === "today" ? "/today" : `/start/${outcome.goalId}`;
    case "signInRequired":
      return `/login?next=${encodeURIComponent(startHref)}`;
    case "limitReached":
    case "failed": {
      const reason = outcome.status === "limitReached" ? outcome.reason : outcome.status;
      const separator = startHref.includes("?") ? "&" : "?";
      return `${startHref}${separator}${COURSE_START_ERROR_PARAM}=${reason}`;
    }
    default:
      return outcome satisfies never;
  }
}

/**
 * The start page's form without JavaScript: a visitor with a session starts the course and goes
 * on; one without is asked to log in first, since a guest is made in the browser. A refusal or a
 * failure brings them back to the page, which says why.
 */
export async function startCourseFormAction(formData: FormData): Promise<void> {
  const courseId = readField(formData, "courseId") ?? "";
  const chapterId = readField(formData, CHAPTER_PARAM);

  const [locale, outcome] = await Promise.all([
    getLocale(),
    startCourseAction({ chapterId, courseId }),
  ]);

  redirect({
    href: getFormDestination({ outcome, startHref: getCourseStartHref({ chapterId, courseId }) }),
    locale,
  });
}
