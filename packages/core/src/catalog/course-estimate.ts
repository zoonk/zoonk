import "server-only";
import { cacheTag, io } from "next/cache";
import { getCourseCacheTag, getCourseCurriculumCacheTag } from "../cache/tags";
import { getPlanNumbers } from "../plans/_utils/plan-numbers";
import { chooseBases } from "../plans/planner/base-choices";
import { type BuildPlanInput, buildPlan } from "../plans/planner/build-plan";
import { daysBetween, fromIsoDate, toIsoDate } from "../plans/planner/plan-calendar";
import { getPlanFeasibility } from "../plans/planner/plan-feasibility";
import { parsePlanSettings } from "../plans/planner/plan-state";
import { toRecommendedBaseChoices } from "../plans/planner/recommended-base-choices";
import { withBuiltSettings } from "../plans/planner/run-outcome";
import { assertTargetDates } from "../plans/target-date-range";
import { type CourseEstimateData, loadCourseEstimateData } from "./_utils/course-estimate-data";
import { getCourseEstimateWorkload } from "./_utils/course-estimate-workload";
import { loadCoursePublishedContent } from "./_utils/course-published-content";
import { summarizeCourseEstimate } from "./_utils/summarize-course-estimate";
import {
  type CoursePlanEstimate,
  type CoursePlanEstimateInput,
  coursePlanEstimateInputSchema,
} from "./course-estimate-contract";

/** Same base recommendation as a new course start, reading any quick outline but creating none. */
function planFromScratch(input: BuildPlanInput) {
  const { advise, input: withBases } = chooseBases(input);
  const settings = { ...input.settings, baseChoices: toRecommendedBaseChoices(advise()) };
  const plannedInput = { ...withBases, settings };
  return { built: buildPlan(plannedInput), plannedInput };
}

async function getCachedCourseEstimate({
  data,
  input,
  publishedContent,
  today,
}: {
  data: CourseEstimateData;
  input: CoursePlanEstimateInput;
  publishedContent: CoursePlanEstimate["publishedContent"];
  today: string;
}): Promise<CoursePlanEstimate | null> {
  "use cache";
  cacheTag(getCourseCacheTag(input.courseId), getCourseCurriculumCacheTag(input.courseId));
  const start = fromIsoDate(today);
  const targetDate = input.targetDate ? fromIsoDate(input.targetDate) : null;

  const settings = parsePlanSettings({
    shortMockMinutes: data.facts.shortMockMinutes,
    startDate: today,
    weekdayMinutes: Array.from({ length: 7 }, (_, day) =>
      input.studyDays.includes(day) ? input.dailyMinutes : 0,
    ),
  });

  const { built, plannedInput } = planFromScratch({
    announcements: data.facts.announcements,
    bands: data.bands,
    bossFacts: data.bossFacts,
    courseStart: true,
    fullMockMinutes: data.facts.fullMockMinutes,
    goal: { dailyMinutes: input.dailyMinutes, kind: data.kind, targetDate },
    graph: data.graph,
    items: [],
    lessons: data.lessons,
    mockClocks: data.facts.mockClocks,
    mockMinutes: data.facts.mockMinutes,
    mode: "forced",
    noticeAreas: data.facts.areaShares ? new Set(data.facts.areaShares.keys()) : null,
    paceFactor: data.pace.factor,
    prerequisites: data.prerequisites,
    quickLessons: data.quickLessons,
    readiness: new Map(),
    settings,
    today: start,
    topicLevels: data.facts.topicLevels,
  });

  const workload = getCourseEstimateWorkload({ built, data });
  const plannedSettings = withBuiltSettings({ built, settings: plannedInput.settings });

  const numbers = getPlanNumbers({
    built,
    context: {
      dailyMinutes: input.dailyMinutes,
      fromDate: today,
      fullCourse: false,
      ownLevel: "none",
      paceFactor: data.pace.factor,
      targetDate: input.targetDate ?? null,
      weekdayMinutes:
        settings.weekdayMinutes ?? Array.from({ length: 7 }, () => input.dailyMinutes),
    },
    coverage: targetDate
      ? getPlanFeasibility({
          examSubjects: data.facts.examSubjects,
          input: plannedInput,
          planned: built,
        })
      : null,
    isExam: data.kind === "exam",
    settings: plannedSettings,
    workload,
  });

  if (targetDate) {
    return { ...summarizeCourseEstimate({ built, data, today: start }), numbers, publishedContent };
  }

  const placedLessons = new Set(
    built.items.flatMap((item) =>
      item.kind === "lesson" && item.status === "todo" && item.lessonId ? [item.lessonId] : [],
    ),
  );

  if (
    !data.chapters.every((chapter) =>
      chapter.lessonIds.every((lessonId) => placedLessons.has(lessonId)),
    )
  ) {
    return null;
  }

  const end = built.estimate.endDate;

  const lessons = built.items.filter(
    (item) => item.kind === "lesson" && item.lessonId && item.status === "todo",
  );

  const chapters = new Map(
    summarizeCourseEstimate({ built, data, today: start }).chapters.map((chapter) => [
      chapter.chapterId,
      chapter,
    ]),
  );

  return {
    chapters: data.chapters.map((chapter) => ({
      chapterId: chapter.chapterId,
      endWeek: chapters.get(chapter.chapterId)?.endWeek ?? null,
      week: chapters.get(chapter.chapterId)?.week ?? null,
      workKinds: chapters.get(chapter.chapterId)?.workKinds ?? [],
    })),
    endDate: end ? toIsoDate(end) : null,
    firstDay: lessons
      .filter((item) => item.scheduledFor?.getTime() === start.getTime())
      .flatMap((item) =>
        item.lessonId
          ? [
              {
                chapterId: item.chapterId,
                dayMinutes: built.lessonDayMinutes.get(item.key)?.get(today) ?? 0,
                estimatedMinutes:
                  (data.lessons.find((lesson) => lesson.lessonId === item.lessonId)?.minutes ??
                    item.minutes) * data.pace.factor,
                lessonId: item.lessonId,
                title: item.titleSnapshot,
              },
            ]
          : [],
      ),
    numbers,
    publishedContent,
    weeks: end ? Math.ceil((daysBetween(start, end) + 1) / 7) : 0,
    workload,
  };
}

/**
 * A public published course planned from scratch at the visitor's time. Private courses never
 * enter the shared cache. Fresh Library inputs key its output across app caches; the UTC start
 * day keys the calendar. No learner data, model calls or writes.
 */
export async function estimateCoursePlan(
  given: CoursePlanEstimateInput,
): Promise<CoursePlanEstimate | null> {
  const parsed = coursePlanEstimateInputSchema.parse(given);

  const input = {
    ...parsed,
    courseId: parsed.courseId.toLowerCase(),
    studyDays: parsed.studyDays.toSorted((a, b) => a - b),
  };

  await io();
  const today = toIsoDate(new Date());
  assertTargetDates({ targets: [{ path: ["targetDate"], targetDate: input.targetDate }], today });
  const data = await loadCourseEstimateData(input.courseId, today);

  if (!data) {
    return null;
  }

  const publishedContent = await loadCoursePublishedContent(data.chapters);
  return getCachedCourseEstimate({ data, input, publishedContent, today });
}
