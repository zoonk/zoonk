import { loadOptionalData } from "@/data/_utils/load-optional-data";
import { getMenu } from "@/lib/menu";
import {
  type ScorePatternsData,
  getCurrentUserScorePatterns,
} from "@zoonk/core/progress/get-score-patterns";
import { getSession } from "@zoonk/core/users/session";
import { StatTile, StatTiles } from "@zoonk/learn/stat-tile";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { formatWholeNumber } from "@zoonk/utils/number";
import { CalendarDaysIcon, ClockIcon, ListChecksIcon } from "lucide-react";
import { getExtracted, getFormatter } from "next-intl/server";
import { ProgressContent } from "../_components/progress-content";
import { ProgressEmptyState } from "../_components/progress-empty-state";
import { STAT_PAGE_TILES_CLASS, StatTilesSkeleton } from "../_components/stats-tiles";
import { type PatternVerdict } from "./_utils/pattern-verdict";
import { DayPatterns, WeekPatterns } from "./pattern-rows";
import {
  PatternsNote,
  getBestDayName,
  getBestTimeName,
  getPatternsSummary,
} from "./pattern-summary";

/** A value the patterns can't name yet. */
const DASH = "–";

const PERCENT = 100;

type Verdict = PatternVerdict<
  ScorePatternsData["weekdays"][number] | ScorePatternsData["times"][number]
>;

/** Under a best day's or time's name: its share and answers, how close they all are, or why not yet. */
async function getVerdictDetail(verdict: Verdict): Promise<string> {
  const t = await getExtracted();
  const format = await getFormatter();

  if (verdict.kind === "even") {
    return t("Within {points, plural, =0 {# points} one {# point} other {# points}}", {
      points: verdict.points,
    });
  }

  if (verdict.kind === "notEnough") {
    return t("Not enough answers yet");
  }

  // Whole percents, as the rows under the tiles say the same share.
  return t("{score} · {count, plural, one {# answer} other {# answers}}", {
    count: verdict.best.totalAnswers,
    score: format.number(verdict.best.score / PERCENT, {
      maximumFractionDigits: 0,
      style: "percent",
    }),
  });
}

/** A name on a tile reads in the text face; numbers keep the mono one. */
function TileName({ children }: { children: string | null }) {
  return children ? <span className="font-sans first-letter:uppercase">{children}</span> : DASH;
}

/**
 * The patterns' three numbers: the best day and the best part of the day (named only when one
 * stands out, `getPatternVerdict`), and the answers they come from.
 */
async function PatternTiles({ patterns }: { patterns: ScorePatternsData }) {
  const t = await getExtracted();
  const format = await getFormatter();
  const summary = getPatternsSummary(patterns);
  const answers = patterns.weekdays.reduce((total, day) => total + day.totalAnswers, 0);

  const dayName = await getBestDayName(summary.days);
  const timeName = await getBestTimeName(summary.times);
  const dayDetail = await getVerdictDetail(summary.days);
  const timeDetail = await getVerdictDetail(summary.times);

  return (
    <StatTiles className={STAT_PAGE_TILES_CLASS}>
      <StatTile
        detail={dayDetail}
        icon={<CalendarDaysIcon />}
        label={t("Best day")}
        tone="success"
        value={<TileName>{dayName}</TileName>}
      />
      <StatTile
        detail={timeDetail}
        icon={<ClockIcon />}
        label={t("Best time")}
        tone="success"
        value={<TileName>{timeName}</TileName>}
      />
      <StatTile
        detail={t("In the last 90 days")}
        icon={<ListChecksIcon />}
        label={t("Answers")}
        value={formatWholeNumber({ format, value: answers })}
      />
    </StatTiles>
  );
}

/**
 * Patterns: the best day and time on tiles, every day of the week and part of the day as rows on
 * one scale (side by side on a wide screen), and the honest lines: a group needs enough answers
 * to count, and a few points apart is no pattern.
 */
export async function PatternsContent() {
  const [resource, session] = await Promise.all([
    loadOptionalData(getCurrentUserScorePatterns),
    getSession(),
  ]);

  const patterns = resource?.patterns;

  if (!(patterns && session)) {
    return <ProgressEmptyState isAuthenticated={Boolean(session)} next={getMenu("patterns").url} />;
  }

  const summary = getPatternsSummary(patterns);

  return (
    <ProgressContent>
      <PatternTiles patterns={patterns} />

      <div className="grid gap-8 lg:grid-cols-2 lg:gap-10">
        <WeekPatterns
          best={summary.days.kind === "best" ? summary.days.best : null}
          patterns={patterns.weekdays}
        />
        <DayPatterns
          best={summary.times.kind === "best" ? summary.times.best : null}
          patterns={patterns.times}
        />
      </div>

      <PatternsNote summary={summary} />
    </ProgressContent>
  );
}

/** The patterns at their size while they load: the tiles, the week and the day, the line. */
export function PatternsContentSkeleton() {
  return (
    <ProgressContent aria-hidden="true">
      <StatTilesSkeleton count={3} />
      <div className="grid gap-8 lg:grid-cols-2 lg:gap-10">
        <div className="flex flex-col gap-3">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-96 w-full rounded-lg" />
        </div>
        <div className="flex flex-col gap-3">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-56 w-full rounded-lg" />
        </div>
      </div>
    </ProgressContent>
  );
}
