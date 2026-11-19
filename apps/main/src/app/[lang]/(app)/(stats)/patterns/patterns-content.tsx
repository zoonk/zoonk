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
import { getBestDayName, getBestTimeName } from "./pattern-summary";

/** The page's finding, in words: when the learner answers best, or that it makes no difference, and the days it covers. */
async function PatternsFinding({ patterns }: { patterns: ScorePatternsData }) {
  const { dayVerdict, timeVerdict } = patterns;

  const [t, dayName, timeName] = await Promise.all([
    getExtracted(),
    getBestDayName(dayVerdict),
    getBestTimeName(timeVerdict),
  ]);

  const day =
    dayVerdict.kind === "best"
      ? t("Your best day is {day}.", { day: dayName ?? "" })
      : dayVerdict.kind === "even" && t("You answer about the same every day.");

  const time =
    timeVerdict.kind === "best"
      ? t("Your best time is the {time}.", { time: (timeName ?? "").toLowerCase() })
      : timeVerdict.kind === "even" && t("The time of day makes no difference.");

  const sentences = [day, time].filter(Boolean);

  return (
    <div className="flex flex-col gap-1">
      <p className="text-lg font-medium text-pretty" data-slot="patterns-finding">
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
