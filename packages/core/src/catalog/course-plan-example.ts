import "server-only";
import { type Course } from "@zoonk/db";
import { daysBetweenIsoDays, getIsoDay } from "@zoonk/utils/calendar-day";
import { logError } from "@zoonk/utils/logger";
import { cacheTag } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { getCourseCacheTag, getCourseCurriculumCacheTag } from "../cache/tags";
import { estimateCoursePlan } from "./course-estimate";
import { getCourseExamDays } from "./course-exam-days";
import {
  type CoursePlanExample,
  hasStudyToShow,
  isDatedEstimate,
} from "./course-plan-example-contract";

const WEEKDAYS = 5;
const STUDY_DAYS = Array.from({ length: WEEKDAYS }, (_, index) => index + 1);

const QUARTER_HOUR = 15;

const DEFAULT_COURSE_PACE = QUARTER_HOUR;
const DEFAULT_EXAM_PACE = 30;

const ISO_DAY_LENGTH = 10;
const ISO_HOUR_LENGTH = 13;

async function getUpcomingExam(courseId: string): Promise<CoursePlanExample["exam"]> {
  const found = await getCourseExamDays(courseId);

  if (!found) {
    return null;
  }

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

async function getCachedCoursePlanExample(basis: ExampleBasis): Promise<CoursePlanExample> {
  "use cache";
  cacheTag(getCourseCacheTag(basis.courseId), getCourseCurriculumCacheTag(basis.courseId));
  // Serialized arguments do not transfer cache tags; depend on notice corrections here too.
  const exam = basis.exam ? await getUpcomingExam(basis.courseId) : null;
  const targetDate = exam?.days[0] ?? null;
  const minutes = targetDate ? DEFAULT_EXAM_PACE : DEFAULT_COURSE_PACE;

  // The exam-zone countdown may still show tomorrow when no UTC study day remains.
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

/** Failures hide the example without caching the failure, so the next regeneration retries. */
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

export async function getExamChapterAreas(
  course: ExampleCourse,
): Promise<Map<string, string> | null> {
  return course.format === "exam" ? getChapterAreas(await getCoursePlanExample(course)) : null;
}
