import { type TaskUsageByName } from "../ai-task-stats";
import {
  COURSE_INPUT_ESTIMATE_NOTE,
  LANGUAGE_TTS_ESTIMATE_NOTE,
  REGULAR_COURSE_ESTIMATE_NOTE,
} from "./ai-cost-estimate-constants";
import {
  buildAggregateLineItem,
  buildGatewayLineItem,
  isEstimateLineItem,
  sumLineItems,
} from "./ai-cost-estimate-helpers";
import {
  type AiCourseEstimateInputs,
  type AiGenerationCostEstimate,
} from "./ai-cost-estimate-types";

/**
 * Regular-course estimates combine the course shell tasks with the weighted
 * lesson totals and the explicit chapter/lesson counts the admin entered for a
 * planned non-language course.
 */
export function buildRegularCourseEstimate({
  courseInputs,
  coreLessonEstimate,
  customLessonEstimate,
  usageByTask,
}: {
  courseInputs: AiCourseEstimateInputs;
  coreLessonEstimate: AiGenerationCostEstimate;
  customLessonEstimate: AiGenerationCostEstimate;
  usageByTask: TaskUsageByName;
}): AiGenerationCostEstimate {
  const totalLessonCount =
    courseInputs.regularChapterCount *
    (courseInputs.regularCoreLessonsPerChapter + courseInputs.regularCustomLessonsPerChapter);
  const totalLessonCost =
    courseInputs.regularChapterCount *
    (courseInputs.regularCoreLessonsPerChapter * coreLessonEstimate.totalEstimatedCost +
      courseInputs.regularCustomLessonsPerChapter * customLessonEstimate.totalEstimatedCost);
  const lineItems = [
    buildGatewayLineItem({ averageRequestsPerRun: 1, taskName: "course-description", usageByTask }),
    buildGatewayLineItem({ averageRequestsPerRun: 1, taskName: "course-thumbnail", usageByTask }),
    buildGatewayLineItem({ averageRequestsPerRun: 1, taskName: "alternative-titles", usageByTask }),
    buildGatewayLineItem({ averageRequestsPerRun: 1, taskName: "course-categories", usageByTask }),
    buildGatewayLineItem({ averageRequestsPerRun: 1, taskName: "course-chapters", usageByTask }),
    buildGatewayLineItem({
      averageRequestsPerRun: courseInputs.regularChapterCount,
      taskName: "chapter-lessons",
      usageByTask,
    }),
    buildGatewayLineItem({
      averageRequestsPerRun: totalLessonCount,
      taskName: "lesson-kind",
      usageByTask,
    }),
    buildAggregateLineItem({
      averageRequestsPerRun: totalLessonCount,
      estimatedCost: totalLessonCost,
      label: "Lesson generation across the full course",
      note: buildRegularCourseInputNote({ courseInputs }),
    }),
  ].filter((item): item is NonNullable<typeof item> => isEstimateLineItem(item));

  return {
    description:
      "Course setup plus the full chapter and lesson content workload for a typical non-language AI course.",
    kind: "regularCourse",
    lineItems,
    notes: [
      COURSE_INPUT_ESTIMATE_NOTE,
      REGULAR_COURSE_ESTIMATE_NOTE,
      buildRegularCourseInputNote({ courseInputs }),
    ],
    runLabel: "selected regular course structures",
    sampleCount: courseInputs.regularChapterCount,
    title: "Full Regular Course",
    totalEstimatedCost: sumLineItems(lineItems),
  };
}

/**
 * Language-course estimates use the same course-shell idea as regular courses,
 * but they roll up the language-lesson estimate so the inferred TTS component
 * is included in the full-course total.
 */
export function buildLanguageCourseEstimate({
  courseInputs,
  languageLessonEstimate,
  usageByTask,
}: {
  courseInputs: AiCourseEstimateInputs;
  languageLessonEstimate: AiGenerationCostEstimate;
  usageByTask: TaskUsageByName;
}): AiGenerationCostEstimate {
  const totalLessonCount =
    courseInputs.languageChapterCount * courseInputs.languageLessonsPerChapter;
  const lineItems = [
    buildGatewayLineItem({ averageRequestsPerRun: 1, taskName: "course-description", usageByTask }),
    buildGatewayLineItem({ averageRequestsPerRun: 1, taskName: "course-thumbnail", usageByTask }),
    buildGatewayLineItem({ averageRequestsPerRun: 1, taskName: "alternative-titles", usageByTask }),
    buildGatewayLineItem({
      averageRequestsPerRun: 1,
      taskName: "language-course-chapters",
      usageByTask,
    }),
    buildGatewayLineItem({
      averageRequestsPerRun: courseInputs.languageChapterCount,
      taskName: "language-chapter-lessons",
      usageByTask,
    }),
    buildAggregateLineItem({
      averageRequestsPerRun: totalLessonCount,
      estimatedCost: totalLessonCount * languageLessonEstimate.totalEstimatedCost,
      label: "Lesson generation across the full course",
      note: buildLanguageCourseInputNote({ courseInputs }),
    }),
  ].filter((item): item is NonNullable<typeof item> => isEstimateLineItem(item));

  return {
    description:
      "Course setup plus the full chapter, lesson content, and inferred TTS workload for a typical language course.",
    kind: "languageCourse",
    lineItems,
    notes: [
      COURSE_INPUT_ESTIMATE_NOTE,
      REGULAR_COURSE_ESTIMATE_NOTE,
      LANGUAGE_TTS_ESTIMATE_NOTE,
      buildLanguageCourseInputNote({ courseInputs }),
    ],
    runLabel: "selected language course structures",
    sampleCount: courseInputs.languageChapterCount,
    title: "Full Language Course",
    totalEstimatedCost: sumLineItems(lineItems),
  };
}

/**
 * Regular courses need both the chapter count and the per-chapter lesson mix in
 * plain language so the admin can confirm the input assumptions at a glance.
 */
function buildRegularCourseInputNote({ courseInputs }: { courseInputs: AiCourseEstimateInputs }) {
  return `Uses ${courseInputs.regularChapterCount.toLocaleString()} chapters with ${courseInputs.regularCoreLessonsPerChapter.toLocaleString()} core lessons and ${courseInputs.regularCustomLessonsPerChapter.toLocaleString()} custom lessons per chapter.`;
}

/**
 * Language courses only need one lesson-count input per chapter, so their
 * summary can stay shorter while still making the selected structure explicit.
 */
function buildLanguageCourseInputNote({ courseInputs }: { courseInputs: AiCourseEstimateInputs }) {
  return `Uses ${courseInputs.languageChapterCount.toLocaleString()} chapters with ${courseInputs.languageLessonsPerChapter.toLocaleString()} language lessons per chapter.`;
}
