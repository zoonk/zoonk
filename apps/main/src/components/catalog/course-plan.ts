import "server-only";
import { cacheUntilMidnight } from "@/lib/public/cache-until-midnight";
import { daysBetweenIsoDays, getIsoDay } from "@/lib/public/calendar-day";
import { estimateCoursePlan } from "@zoonk/core/catalog/course-estimate";
import { getCourseExamDays } from "@zoonk/core/catalog/course-exam-days";
import { logError } from "@zoonk/utils/logger";
import { unstable_rethrow } from "next/navigation";
import { type PaceEstimate, hasStudyToShow, isDatedEstimate } from "./plan-estimate";

/** The example plan studies Monday to Friday: the planner numbers weekdays from Sunday, 0. */
const WEEKDAYS = 5;
const STUDY_DAYS = Array.from({ length: WEEKDAYS }, (_, index) => index + 1);

const QUARTER_HOUR = 15;

/** The times a day a visitor can try: shorter for a course, longer for an exam read against its date. */
const COURSE_PACES = [10, QUARTER_HOUR, 30];
const EXAM_PACES = [QUARTER_HOUR, 30, 60];

const DEFAULT_COURSE_PACE = QUARTER_HOUR;
const DEFAULT_EXAM_PACE = 30;

/** The course's example plan: each time a day it can show, the one picked first and its exam's days. */
export type CoursePlanExample = {
  defaultMinutes: number;
  /** An exam course's next sitting, its days from today on, counted in the exam's time zone. */
  exam: { days: string[]; daysLeft: number; estimated: boolean; timeZone: string } | null;
  paces: PaceEstimate[];
};

/** Core's estimate starts its plan from the day in UTC. */
const UTC = "UTC";

/**
 * An exam course's next sitting from today on, or null when there's none to read the plan against
 * (no sitting found, or every day of it past).
 */
async function getUpcomingExam(courseId: string): Promise<CoursePlanExample["exam"]> {
  const found = await getCourseExamDays(courseId);

  if (!found) {
    return null;
  }

  // The countdown counts the exam's own days, so a night in Brazil still reads as that day.
  const today = getIsoDay({ now: new Date(), timeZone: found.timeZone });
  const days = found.days.filter((day) => day >= today);
  const [first] = days;

  return first
    ? {
        days,
        daysLeft: daysBetweenIsoDays({ from: today, to: first }),
        estimated: found.estimated,
        timeZone: found.timeZone,
      }
    : null;
}

/**
 * The course's plan at each time a day a visitor can pick, from core's planner (no AI, no writes):
 * against the exam's next day for an exam course, to the end of the course otherwise. A pace core
 * can't estimate is left out.
 */
async function getPaceEstimates({
  courseId,
  targetDate,
}: {
  courseId: string;
  targetDate: string | null;
}): Promise<PaceEstimate[]> {
  const paces = targetDate ? EXAM_PACES : COURSE_PACES;

  const results = await Promise.all(
    paces.map(async (minutes) => {
      const estimate = await estimateCoursePlan({
        courseId,
        dailyMinutes: minutes,
        studyDays: STUDY_DAYS,
        ...(targetDate && { targetDate }),
      });

      return estimate && hasStudyToShow(estimate) ? { estimate, minutes } : null;
    }),
  );

  return results.filter((pace) => pace !== null);
}

/**
 * The example plan in a private cache: a runtime prefetch carries it (so a tap paints it at once)
 * and one request reads it once, while every new request reaches core's own fresh checks. Another
 * app (the API, Admin) revises an exam's notice or a course's chapters without touching this
 * app's tags or the course's row, so a shared cache here would keep the old sitting and plan;
 * core's estimate and exam days keep their own shared caches, keyed by fresh versions. A browser
 * keeps the plan until the day changes, its countdown and estimate reading today's date.
 */
async function getPrivateCoursePlanExample(
  courseId: string,
  isExam: boolean,
): Promise<CoursePlanExample> {
  "use cache: private";
  const exam = isExam ? await getUpcomingExam(courseId) : null;
  // Both days the plan reads change at their own midnight: the estimate's and the countdown's.
  cacheUntilMidnight(exam ? [UTC, exam.timeZone] : [UTC]);

  const targetDate = exam?.days[0] ?? null;
  const paces = await getPaceEstimates({ courseId, targetDate });

  return { defaultMinutes: targetDate ? DEFAULT_EXAM_PACE : DEFAULT_COURSE_PACE, exam, paces };
}

/**
 * The course's example plan, which the hero's eyebrow, the plan window and the outline's marks
 * read: an exam course's next sitting and the plan against its first day, any other course's plan
 * to its end. A failure is never cached and only hides the example: the page stands without it.
 */
export async function getCoursePlanExample(course: {
  format: string;
  id: string;
}): Promise<CoursePlanExample> {
  const isExam = course.format === "exam";

  try {
    return await getPrivateCoursePlanExample(course.id, isExam);
  } catch (error) {
    // Next's own signals (a prerender's interrupted request) must keep propagating.
    unstable_rethrow(error);
    logError("Course plan example failed", { courseId: course.id, error });

    return {
      defaultMinutes: isExam ? DEFAULT_EXAM_PACE : DEFAULT_COURSE_PACE,
      exam: null,
      paces: [],
    };
  }
}

/**
 * The time a day the example plan shows first: its default pace when it could estimate it, else
 * its first. Null without any pace to show.
 */
export function getFirstShownPace(plan: Pick<CoursePlanExample, "defaultMinutes" | "paces">) {
  const [first] = plan.paces;

  if (!first) {
    return null;
  }

  return plan.paces.some((pace) => pace.minutes === plan.defaultMinutes)
    ? plan.defaultMinutes
    : first.minutes;
}

/**
 * An exam course's chapters by the exam's area, as its plan against the exam's day reads them
 * (the default pace's), for pages that place a chapter in the exam. Null for a course read to its
 * end, or while any of its chapters has no area: the levels place them then.
 */
function getChapterAreas(plan: CoursePlanExample): Map<string, string> | null {
  const paces = plan.paces.toSorted(
    (a, b) => Number(b.minutes === plan.defaultMinutes) - Number(a.minutes === plan.defaultMinutes),
  );

  const dated = paces.map((pace) => pace.estimate).find((estimate) => isDatedEstimate(estimate));

  if (!dated || dated.chapters.some((chapter) => !chapter.area)) {
    return null;
  }

  return new Map(dated.chapters.map((chapter) => [chapter.chapterId, chapter.area ?? ""]));
}

/**
 * `getChapterAreas` for a chapter's page, which shows nothing else of the example plan: only an
 * exam course's plan reads its chapters by area, so any other course isn't planned at all.
 */
export async function getExamChapterAreas(course: {
  format: string;
  id: string;
}): Promise<Map<string, string> | null> {
  return course.format === "exam" ? getChapterAreas(await getCoursePlanExample(course)) : null;
}
