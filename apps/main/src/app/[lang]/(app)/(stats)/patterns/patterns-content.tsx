import { loadOptionalData } from "@/data/_utils/load-optional-data";
import { getMenu } from "@/lib/menu";
import {
  type ScorePatternsData,
  getCurrentUserScorePatterns,
} from "@zoonk/core/progress/get-score-patterns";
import { getSession } from "@zoonk/core/users/session";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { getExtracted } from "next-intl/server";
import { ProgressContent } from "../_components/progress-content";
import { ProgressEmptyState } from "../_components/progress-empty-state";
import { PatternChartSkeleton } from "./pattern-chart";
import { DayPatterns, WeekPatterns } from "./pattern-charts";
import { getBestDayName } from "./pattern-summary";

/** In core's period order, as `getTimePeriodNames`. */
const TIME_PERIODS = ["night", "morning", "afternoon", "evening"] as const;

/** The page's finding, in words: when the learner answers best, or that it makes no difference, and the days it covers. */
async function PatternsFinding({ patterns }: { patterns: ScorePatternsData }) {
  const { dayVerdict, timeVerdict } = patterns;

  const [t, dayName] = await Promise.all([getExtracted(), getBestDayName(dayVerdict)]);

  const day =
    dayVerdict.kind === "best"
      ? t("Your best day is {day}.", { day: dayName ?? "" })
      : dayVerdict.kind === "even" && t("You answer about the same every day.");

  const time =
    timeVerdict.kind === "best"
      ? t(
          "{period, select, night {You do best at night.} morning {You do best in the morning.} afternoon {You do best in the afternoon.} other {You do best in the evening.}}",
          { period: TIME_PERIODS.at(timeVerdict.best.period) ?? "evening" },
        )
      : timeVerdict.kind === "even" && t("The time of day makes no difference.");

  const sentences = [day, time].filter(Boolean);

  return (
    <div className="flex flex-col gap-1">
      <p className="text-lg font-medium" data-slot="patterns-finding">
        {sentences.length > 0
          ? sentences.join(" ")
          : t("Answer more questions to see when you do best.")}
      </p>
      <p className="text-muted-foreground text-xs">{t("Past 90 days")}</p>
    </div>
  );
}

export async function PatternsContent() {
  const [resource, session] = await Promise.all([
    loadOptionalData(getCurrentUserScorePatterns),
    getSession(),
  ]);

  const patterns = resource?.patterns;

  if (!(patterns && session)) {
    return <ProgressEmptyState isAuthenticated={Boolean(session)} next={getMenu("patterns").url} />;
  }

  return (
    <ProgressContent>
      <PatternsFinding patterns={patterns} />

      <div className="grid gap-8 lg:grid-cols-2 lg:gap-10">
        <WeekPatterns patterns={patterns.weekdays} verdict={patterns.dayVerdict} />
        <DayPatterns patterns={patterns.times} verdict={patterns.timeVerdict} />
      </div>
    </ProgressContent>
  );
}

export function PatternsContentSkeleton() {
  return (
    <ProgressContent aria-hidden="true">
      <div className="flex flex-col gap-1">
        <Skeleton className="my-1 h-5 w-64 max-w-full" />
        <Skeleton className="my-0.5 h-3 w-20" />
      </div>
      <div className="grid gap-8 lg:grid-cols-2 lg:gap-10">
        <PatternChartSkeleton columns={7} titleClassName="w-36" />
        <PatternChartSkeleton columns={4} icons titleClassName="w-40" />
      </div>
    </ProgressContent>
  );
}
