import { StatsSection, StatsSectionSkeleton } from "@/components/stats-section";
import {
  type AiCourseEstimateInputOverrides,
  type AiCourseEstimateInputs,
  type AiGenerationCostEstimate,
  getAiCostEstimates,
} from "@/data/stats/ai/get-ai-cost-estimates";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { AdminMetricCard } from "../_components/admin-metric-card";
import { AiEstimateBreakdown } from "./ai-estimate-breakdown";
import { AiEstimateFilters } from "./ai-estimate-filters";
import { formatAiCost, formatAiStatsDate } from "./format-ai-cost";

/**
 * The estimates page focuses on workflow costs rather than raw task activity.
 * It loads the selected-period lesson averages, resolves the editable course
 * structure inputs, and renders the resulting lesson and course totals.
 */
export async function AiEstimateDashboard({
  courseInputOverrides,
  endDate,
  startDate,
}: {
  courseInputOverrides: AiCourseEstimateInputOverrides;
  endDate: string;
  startDate: string;
}) {
  const report = await getAiCostEstimates({ courseInputOverrides, endDate, startDate });
  const lessonEstimates = report.estimates.filter((estimate) => isLessonEstimate(estimate));
  const courseEstimates = report.estimates.filter((estimate) => isCourseEstimate(estimate));
  const summaries = Object.fromEntries(
    report.estimates.map((estimate) => [
      estimate.kind,
      getEstimateSummary({ courseInputs: report.courseInputs, estimate }),
    ]),
  );

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-2">
        <p className="text-muted-foreground text-sm">
          Lesson estimates use average task cost from {formatAiStatsDate(startDate)} to{" "}
          {formatAiStatsDate(endDate)}.
        </p>
        <p className="text-muted-foreground text-sm">
          Language audio is inferred from newly created word and sentence audio because those TTS
          calls do not appear in the Vercel Custom Reporting API.
        </p>
      </div>

      <AiEstimateFilters
        actionHref="/stats/ai/estimates"
        courseInputs={report.courseInputs}
        defaultCourseInputs={report.defaultCourseInputs}
        endDate={endDate}
        startDate={startDate}
      />

      <StatsSection
        subtitle="Each total combines the average task cost with the average number of task runs needed to finish one lesson in this period."
        title="Estimated Lesson Cost"
      >
        {lessonEstimates.map((estimate) => (
          <AdminMetricCard
            description={summaries[estimate.kind]}
            key={estimate.kind}
            title={estimate.title}
            value={formatAiCost(estimate.totalEstimatedCost)}
          />
        ))}
      </StatsSection>

      <StatsSection
        subtitle="These totals use the chapter and lesson counts entered above instead of waiting for fully generated courses to exist."
        title="Estimated Course Cost"
      >
        {courseEstimates.map((estimate) => (
          <AdminMetricCard
            description={summaries[estimate.kind]}
            key={estimate.kind}
            title={estimate.title}
            value={formatAiCost(estimate.totalEstimatedCost)}
          />
        ))}
      </StatsSection>

      <AiEstimateBreakdown estimates={report.estimates} summaries={summaries} />
    </div>
  );
}

/**
 * The estimates page mixes Gateway reports and database aggregates, so this
 * placeholder keeps the layout stable while those server queries resolve after
 * navigation or filter changes.
 */
export function AiEstimateDashboardSkeleton() {
  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-72" />
        <Skeleton className="h-4 w-96" />
      </div>

      <section className="flex flex-col gap-4">
        <header className="flex flex-col gap-1">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-96" />
        </header>
        <Skeleton className="h-72 w-full rounded-lg" />
      </section>

      <StatsSectionSkeleton items={3} />
      <StatsSectionSkeleton items={2} />

      <section className="flex flex-col gap-4">
        <header className="flex flex-col gap-0.5">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-96" />
        </header>
        <Skeleton className="h-80 w-full rounded-lg" />
      </section>
    </div>
  );
}

/**
 * Lesson estimates should surface how much historical lesson data exists in the
 * selected period, while course estimates should echo the explicit course shape
 * the admin entered above.
 */
function getEstimateSummary({
  courseInputs,
  estimate,
}: {
  courseInputs: AiCourseEstimateInputs;
  estimate: AiGenerationCostEstimate;
}) {
  if (estimate.kind === "regularCourse") {
    return `${courseInputs.regularChapterCount.toLocaleString()} chapters, ${courseInputs.regularCoreLessonsPerChapter.toLocaleString()} core/chapter, ${courseInputs.regularCustomLessonsPerChapter.toLocaleString()} custom/chapter.`;
  }

  if (estimate.kind === "languageCourse") {
    return `${courseInputs.languageChapterCount.toLocaleString()} chapters, ${courseInputs.languageLessonsPerChapter.toLocaleString()} language/chapter.`;
  }

  if (estimate.sampleCount <= 0) {
    return `No ${estimate.runLabel} in this period.`;
  }

  return `Based on ${estimate.sampleCount.toLocaleString()} ${estimate.runLabel}.`;
}

/**
 * Lesson and course estimates are rendered in separate card groups so the page
 * answers the user's questions in the same buckets they asked for.
 */
function isLessonEstimate(
  estimate: AiGenerationCostEstimate,
): estimate is AiGenerationCostEstimate {
  return (
    estimate.kind === "coreLesson" ||
    estimate.kind === "customLesson" ||
    estimate.kind === "languageLesson"
  );
}

/**
 * Course totals use a different mental model than lesson totals because they
 * are driven by explicit chapter and lesson counts entered on the page.
 */
function isCourseEstimate(
  estimate: AiGenerationCostEstimate,
): estimate is AiGenerationCostEstimate {
  return estimate.kind === "regularCourse" || estimate.kind === "languageCourse";
}
