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
import { DayPatterns, WeekPatterns } from "./pattern-rows";
import { PatternsNote, getBestDayName, getBestTimeName } from "./pattern-summary";

const DASH = "–";

const PERCENT = 100;

type Verdict = ScorePatternsData["dayVerdict"] | ScorePatternsData["timeVerdict"];

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

  return t("{score} · {count, plural, one {# answer} other {# answers}}", {
    count: verdict.best.totalAnswers,
    score: format.number(verdict.best.score / PERCENT, {
      maximumFractionDigits: 0,
      style: "percent",
    }),
  });
}

function TileName({ children }: { children: string | null }) {
  return children ? <span className="font-sans first-letter:uppercase">{children}</span> : DASH;
}

async function PatternTiles({ patterns }: { patterns: ScorePatternsData }) {
  const t = await getExtracted();
  const format = await getFormatter();
  const answers = patterns.weekdays.reduce((total, day) => total + day.totalAnswers, 0);

  const dayName = await getBestDayName(patterns.dayVerdict);
  const timeName = await getBestTimeName(patterns.timeVerdict);
  const dayDetail = await getVerdictDetail(patterns.dayVerdict);
  const timeDetail = await getVerdictDetail(patterns.timeVerdict);

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

export async function PatternsContent() {
  const [resource, session] = await Promise.all([
    loadOptionalData(getCurrentUserScorePatterns),
    getSession(),
  ]);

  const patterns = resource?.patterns;

  if (!(patterns && session)) {
    return <ProgressEmptyState isAuthenticated={Boolean(session)} next={getMenu("patterns").url} />;
  }

  const { dayVerdict, timeVerdict } = patterns;

  return (
    <ProgressContent>
      <PatternTiles patterns={patterns} />

      <div className="grid gap-8 lg:grid-cols-2 lg:gap-10">
        <WeekPatterns
          best={dayVerdict.kind === "best" ? dayVerdict.best : null}
          patterns={patterns.weekdays}
        />
        <DayPatterns
          best={timeVerdict.kind === "best" ? timeVerdict.best : null}
          patterns={patterns.times}
        />
      </div>

      <PatternsNote patterns={patterns} />
    </ProgressContent>
  );
}

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
