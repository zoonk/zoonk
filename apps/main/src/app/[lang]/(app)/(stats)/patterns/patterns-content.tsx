import { loadOptionalData } from "@/data/_utils/load-optional-data";
import { getMenu } from "@/lib/menu";
import {
  type ScorePatternsData,
  getCurrentUserScorePatterns,
} from "@zoonk/core/progress/get-score-patterns";
import { getSession } from "@zoonk/core/users/session";
import { getExtracted } from "next-intl/server";
import { ProgressContent } from "../_components/progress-content";
import { ProgressEmptyState } from "../_components/progress-empty-state";
import { StatTilesSkeleton } from "../_components/stats-tiles";
import { PatternChartSkeleton } from "./pattern-chart";
import { DayPatterns, WeekPatterns } from "./pattern-charts";
import { getBestDayName, getBestTimeName } from "./pattern-summary";

/** The page's finding, in words: when the learner answers best, or that it makes no difference. */
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
    <p className="text-lg font-medium text-pretty" data-slot="patterns-finding">
      {sentences.length > 0
        ? sentences.join(" ")
        : t("Answer more questions to see when you do best.")}
    </p>
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
      <StatTilesSkeleton count={1} />
      <div className="grid gap-8 lg:grid-cols-2 lg:gap-10">
        <PatternChartSkeleton columns={7} titleClassName="w-36" />
        <PatternChartSkeleton columns={4} icons titleClassName="w-40" />
      </div>
    </ProgressContent>
  );
}
