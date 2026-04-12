import { calculateAverageRequestsPerEntity } from "../ai-task-stats";
import { type AiCourseEstimateInputs, type StructureStats } from "./ai-cost-estimate-types";

type CourseInputOverride = number | string | undefined;

/**
 * Course totals should be editable because course generation is on-demand and
 * we often do not have many fully generated courses to average from. These
 * defaults seed the form with the nearest observed structure from the selected
 * period when data exists.
 */
export function buildDefaultCourseEstimateInputs({
  structureStats,
}: {
  structureStats: StructureStats;
}): AiCourseEstimateInputs {
  return {
    languageChapterCount: normalizeInteger({
      fallback: 1,
      minimum: 1,
      value: roundAverage({
        entityCount: structureStats.languageCourseCount,
        totalCount: structureStats.languageCourseChapterCount,
      }),
    }),
    languageLessonsPerChapter: normalizeInteger({
      fallback: 1,
      minimum: 1,
      value: roundAverage({
        entityCount: structureStats.completedLanguageChapterCount,
        totalCount: structureStats.languageLessonCountInCourses,
      }),
    }),
    regularChapterCount: normalizeInteger({
      fallback: 1,
      minimum: 1,
      value: roundAverage({
        entityCount: structureStats.regularCourseCount,
        totalCount: structureStats.regularCourseChapterCount,
      }),
    }),
    regularCoreLessonsPerChapter: normalizeInteger({
      fallback: 1,
      minimum: 1,
      value: roundAverage({
        entityCount: structureStats.completedRegularChapterCount,
        totalCount: structureStats.regularCoreLessonCountInCourses,
      }),
    }),
    regularCustomLessonsPerChapter: normalizeInteger({
      fallback: 0,
      minimum: 0,
      value: roundAverage({
        entityCount: structureStats.completedRegularChapterCount,
        totalCount: structureStats.regularCustomLessonCountInCourses,
      }),
    }),
  };
}

/**
 * Search params are free-form strings. This resolver clamps them to safe whole
 * numbers while preserving the selected-period defaults when the input is
 * missing or invalid.
 */
export function resolveCourseEstimateInputs({
  defaults,
  overrides,
}: {
  defaults: AiCourseEstimateInputs;
  overrides?: Partial<Record<keyof AiCourseEstimateInputs, CourseInputOverride>>;
}): AiCourseEstimateInputs {
  return {
    languageChapterCount: normalizeInteger({
      fallback: defaults.languageChapterCount,
      minimum: 1,
      value: overrides?.languageChapterCount,
    }),
    languageLessonsPerChapter: normalizeInteger({
      fallback: defaults.languageLessonsPerChapter,
      minimum: 1,
      value: overrides?.languageLessonsPerChapter,
    }),
    regularChapterCount: normalizeInteger({
      fallback: defaults.regularChapterCount,
      minimum: 1,
      value: overrides?.regularChapterCount,
    }),
    regularCoreLessonsPerChapter: normalizeInteger({
      fallback: defaults.regularCoreLessonsPerChapter,
      minimum: 1,
      value: overrides?.regularCoreLessonsPerChapter,
    }),
    regularCustomLessonsPerChapter: normalizeInteger({
      fallback: defaults.regularCustomLessonsPerChapter,
      minimum: 0,
      value: overrides?.regularCustomLessonsPerChapter,
    }),
  };
}

/**
 * Course defaults only need whole-number suggestions for the form, so the
 * selected-period averages get rounded here before any min/fallback rules
 * apply.
 */
function roundAverage({
  entityCount,
  totalCount,
}: {
  entityCount: number;
  totalCount: number;
}): number {
  return Math.round(calculateAverageRequestsPerEntity({ entityCount, requestCount: totalCount }));
}

/**
 * Course planning inputs represent counts, not arbitrary numeric weights. This
 * helper keeps those values as non-negative integers and falls back cleanly when
 * the URL contains anything unexpected.
 */
function normalizeInteger({
  fallback,
  minimum,
  value,
}: {
  fallback: number;
  minimum: number;
  value: CourseInputOverride;
}) {
  const parsedValue = typeof value === "number" ? value : Number.parseInt(value ?? "", 10);

  if (!Number.isInteger(parsedValue) || parsedValue < minimum) {
    return fallback;
  }

  return parsedValue;
}
