"use server";

import { getAppLocale } from "@/i18n/locale";
import { redirect } from "@/i18n/navigation";
import { postAsLearner } from "@/lib/api/learner-api";
import { toGoalStartFailure } from "@/lib/goals/goal-limit-reason";
import {
  CHAPTER_PARAM,
  MINUTES_PARAM,
  getCourseStartHref,
  readDailyMinutes,
} from "@/lib/public/public-hrefs";
import { courseGoalStartInputSchema } from "@zoonk/core/goals/course-start-contract";
import { findCourseGoalStart } from "@zoonk/core/goals/start-course";
import { type OnboardingOwnLevel } from "@zoonk/core/view-models/onboarding/contract";
import { type GoalLimitReason } from "@zoonk/learn/onboarding/actions";
import { isUuid } from "@zoonk/utils/uuid";
import { z } from "zod";
import { COURSE_START_ERROR_PARAM } from "./course/course-start-params";

const CREATED = 201;
const UNAUTHORIZED = 401;

const goalSchema = z.object({ id: z.string() });

export type CourseStartOutcome =
  | { goalId: string; next: "steps" | "today"; status: "started" }
  | { reason: GoalLimitReason; status: "limitReached" }
  | { status: "failed" | "signInRequired" };

function toRefusedOutcome({
  json,
  status,
}: {
  json: unknown;
  status: number | null;
}): CourseStartOutcome {
  if (status === UNAUTHORIZED) {
    return { status: "signInRequired" };
  }

  return toGoalStartFailure(json);
}

export async function startCourseAction({
  chapterId,
  courseId,
  dailyMinutes,
  level,
  timeZone,
}: {
  chapterId?: string | null;
  courseId: string;
  dailyMinutes?: number | null;
  level?: OnboardingOwnLevel | null;
  timeZone?: string;
}): Promise<CourseStartOutcome> {
  const input = courseGoalStartInputSchema.safeParse({
    chapterId: chapterId ?? undefined,
    dailyMinutes: dailyMinutes ?? undefined,
    level,
    timeZone,
  });

  if (!input.success || !isUuid(courseId)) {
    return { status: "failed" };
  }

  const response = await postAsLearner({
    body: input.data,
    path: `/v1/courses/${encodeURIComponent(courseId)}/goals`,
  });

  if (!response.ok) {
    return toRefusedOutcome(response);
  }

  const goal = goalSchema.safeParse(response.json).data;

  if (!goal) {
    return { status: "failed" };
  }

  if (response.status === CREATED) {
    return { goalId: goal.id, next: "steps", status: "started" };
  }

  const existing = await findCourseGoalStart(courseId);

  return { goalId: goal.id, next: existing?.inOnboarding ? "steps" : "today", status: "started" };
}

function readField(formData: FormData, name: string): string | null {
  const value = formData.get(name);
  return typeof value === "string" && value ? value : null;
}

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

/** Without JavaScript, someone without a session is asked to log in first: a guest is made in the browser. */
export async function startCourseFormAction(formData: FormData): Promise<void> {
  const courseId = readField(formData, "courseId") ?? "";
  const chapterId = readField(formData, CHAPTER_PARAM);
  const minutes = readDailyMinutes(readField(formData, MINUTES_PARAM) ?? undefined);

  const locale = await getAppLocale();
  const outcome = await startCourseAction({ chapterId, courseId, dailyMinutes: minutes });

  redirect({
    href: getFormDestination({
      outcome,
      startHref: getCourseStartHref({ chapterId, courseId, minutes }),
    }),
    locale,
  });
}
