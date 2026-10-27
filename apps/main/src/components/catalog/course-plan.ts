import "server-only";
import { daysBetweenIsoDays, getIsoDay } from "@/lib/public/calendar-day";
import { getCourseCacheTag, getCourseCurriculumCacheTag } from "@zoonk/core/cache-tags";
import { estimateCoursePlan } from "@zoonk/core/catalog/course-estimate";
import { getCourseExamDays } from "@zoonk/core/catalog/course-exam-days";
import { type Course } from "@zoonk/db";
import { logError } from "@zoonk/utils/logger";
import { cacheTag } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { type PaceEstimate, hasStudyToShow, isDatedEstimate } from "./plan-estimate";

/** The example plan studies Monday to Friday: the planner numbers weekdays from Sunday, 0. */
const WEEKDAYS = 5;
const STUDY_DAYS = Array.from({ length: WEEKDAYS }, (_, index) => index + 1);

const QUARTER_HOUR = 15;

const DEFAULT_COURSE_PACE = QUARTER_HOUR;
const DEFAULT_EXAM_PACE = 30;

/** The selected public example and its exam's days. */
export type CoursePlanExample = {
  /** An exam course's next sitting, its days from today on, counted in the exam's time zone. */
  exam: { days: string[]; daysLeft: number; estimated: boolean; timeZone: string } | null;
  pace: PaceEstimate | null;
};

const ISO_DAY_LENGTH = 10;
const ISO_HOUR_LENGTH = 13;

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

type ExampleCourse = Pick<Course, "format" | "id" | "updatedAt">;

type ExampleBasis = {
  contentRevision: Date;
  courseId: string;
  exam: CoursePlanExample["exam"];
  /** UTC day and hour; the serialized exam also keys its zone and edition days. */
  hour: string;
};

/**
 * The example plan in the app's shared cache, so the course's page is static: the same for every
 * visitor, worked out again in the background as the default cache lifetime revalidates it, so a
 * new hour or day shows soon after it starts. The course's and its curriculum's tags expire it when
 * the course or its outline changes, and an exam's notice does through the tag core's exam days
 * carry; the other inputs the planner reads (lesson specs, skills, item banks, paces) show at its
 * next revalidation.
 */
async function getCachedExampleBasis(course: ExampleCourse): Promise<ExampleBasis> {
  "use cache";
  cacheTag(getCourseCacheTag(course.id), getCourseCurriculumCacheTag(course.id));
  const exam = course.format === "exam" ? await getUpcomingExam(course.id) : null;

  return {
    contentRevision: course.updatedAt,
    courseId: course.id,
    exam,
    hour: new Date().toISOString().slice(0, ISO_HOUR_LENGTH),
  };
}

/**
 * One selected build on a shared cache miss. Next's build and function IDs key the planner code
 * version; the serialized basis keys the content revision, exam edition/zone and UTC day/hour.
 * Publication tags refresh the basis and result together. No learner state enters either cache.
 */
async function getCachedCoursePlanExample(basis: ExampleBasis): Promise<CoursePlanExample> {
  "use cache";
  cacheTag(getCourseCacheTag(basis.courseId), getCourseCurriculumCacheTag(basis.courseId));
  // The serialized basis doesn't transfer its cache tags. This entry must also depend on the
  // notice, including corrections to its structure that leave every sitting day unchanged.
  const exam = basis.exam ? await getUpcomingExam(basis.courseId) : null;
  const targetDate = exam?.days[0] ?? null;
  const minutes = targetDate ? DEFAULT_EXAM_PACE : DEFAULT_COURSE_PACE;

  // Core's public estimate starts in UTC and requires tomorrow or later. Keep the exam's own
  // calendar visible when it still says tomorrow, but there is no remaining UTC study day.
  if (targetDate && targetDate <= basis.hour.slice(0, ISO_DAY_LENGTH)) {
    return { exam, pace: null };
  }

  const estimate = await estimateCoursePlan({
    courseId: basis.courseId,
    dailyMinutes: minutes,
    studyDays: STUDY_DAYS,
    ...(targetDate && { targetDate }),
  });

  return { exam, pace: estimate && hasStudyToShow(estimate) ? { estimate, minutes } : null };
}

/**
 * The course's example plan, which the hero's eyebrow, the plan window and the outline's marks
 * read: an exam course's next sitting and the plan against its first day, any other course's plan
 * to its end. A failure only hides the example: the plan's cache doesn't keep it, so the page's
 * next regeneration tries again.
 */
export async function getCoursePlanExample(course: ExampleCourse): Promise<CoursePlanExample> {
  try {
    return await getCachedCoursePlanExample(await getCachedExampleBasis(course));
  } catch (error) {
    // Next's own signals (a prerender's interrupted request) must keep propagating.
    unstable_rethrow(error);
    logError("Course plan example failed", { courseId: course.id, error });

    return { exam: null, pace: null };
  }
}

/**
 * An exam course's chapters by the exam's area, as its plan against the exam's day reads them
 * (the default pace's), for pages that place a chapter in the exam. Null for a course read to its
 * end, or while any of its chapters has no area: the levels place them then.
 */
function getChapterAreas(plan: CoursePlanExample): Map<string, string> | null {
  const estimate = plan.pace?.estimate;

  if (
    !estimate ||
    !isDatedEstimate(estimate) ||
    estimate.chapters.some((chapter) => !chapter.area)
  ) {
    return null;
  }

  return new Map(estimate.chapters.map((chapter) => [chapter.chapterId, chapter.area ?? ""]));
}

/**
 * `getChapterAreas` for a chapter's page, which shows nothing else of the example plan: only an
 * exam course's plan reads its chapters by area, so any other course isn't planned at all.
 */
export async function getExamChapterAreas(
  course: ExampleCourse,
): Promise<Map<string, string> | null> {
  return course.format === "exam" ? getChapterAreas(await getCoursePlanExample(course)) : null;
}
