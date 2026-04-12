import "server-only";
import {
  type AiCostEstimateReport,
  type AiCourseEstimateInputOverrides,
} from "./_utils/ai-cost-estimate-types";
import {
  buildDefaultCourseEstimateInputs,
  resolveCourseEstimateInputs,
} from "./_utils/ai-course-estimate-inputs";
import {
  buildLanguageCourseEstimate,
  buildRegularCourseEstimate,
} from "./_utils/build-ai-course-cost-estimates";
import {
  buildCoreLessonEstimate,
  buildCustomLessonEstimate,
  buildLanguageLessonEstimate,
} from "./_utils/build-ai-lesson-cost-estimates";
import { getStructureStats } from "./_utils/get-ai-cost-estimate-structure";
import { getAiTaskUsageMap } from "./get-ai-task-usage-map";

export type {
  AiCourseEstimateInputOverrides,
  AiCourseEstimateInputs,
  AiGenerationCostEstimate,
  EstimateLineItem,
} from "./_utils/ai-cost-estimate-types";

/**
 * The AI stats index needs workflow-level answers, not raw task rows. This
 * loader combines Gateway cost averages with the content-shape averages we can
 * derive from the database for the same date range.
 */
export async function getAiCostEstimates({
  courseInputOverrides,
  endDate,
  startDate,
}: {
  courseInputOverrides?: AiCourseEstimateInputOverrides;
  endDate: string;
  startDate: string;
}): Promise<AiCostEstimateReport> {
  const [usageByTask, structureStats] = await Promise.all([
    getAiTaskUsageMap({ endDate, startDate }),
    getStructureStats({ endDate, startDate }),
  ]);
  const defaultCourseInputs = buildDefaultCourseEstimateInputs({ structureStats });
  const courseInputs = resolveCourseEstimateInputs({
    defaults: defaultCourseInputs,
    overrides: courseInputOverrides,
  });
  const coreLessonEstimate = buildCoreLessonEstimate({ structureStats, usageByTask });
  const customLessonEstimate = buildCustomLessonEstimate({ structureStats, usageByTask });
  const languageLessonEstimate = buildLanguageLessonEstimate({ structureStats, usageByTask });

  return {
    courseInputs,
    defaultCourseInputs,
    estimates: [
      coreLessonEstimate,
      customLessonEstimate,
      languageLessonEstimate,
      buildRegularCourseEstimate({
        coreLessonEstimate,
        courseInputs,
        customLessonEstimate,
        usageByTask,
      }),
      buildLanguageCourseEstimate({
        courseInputs,
        languageLessonEstimate,
        usageByTask,
      }),
    ],
  };
}
