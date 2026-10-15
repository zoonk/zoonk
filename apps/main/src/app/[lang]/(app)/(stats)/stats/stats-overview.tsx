import { getProgressLearningTimeLabel } from "@/components/progress/progress-learning-time-label";
import { loadOptionalData } from "@/data/_utils/load-optional-data";
import { type AppRoute, Link } from "@/i18n/navigation";
import { getBeltLabel } from "@/lib/belt-colors";
import { getMenu } from "@/lib/menu";
import { type EnergyData } from "@zoonk/core/progress/energy";
import { type BeltLevelDetails } from "@zoonk/core/progress/get-belt-level";
import {
  type CurrentUserProgress,
  getCurrentUserProgress,
} from "@zoonk/core/progress/get-current-user";
import { getEnergyData } from "@zoonk/core/progress/get-energy-data";
import { getEnergyStarted } from "@zoonk/core/progress/get-energy-started";
import { getLearningActivity } from "@zoonk/core/progress/get-learning-activity";
import { getScoreHistory } from "@zoonk/core/progress/get-score-history";
import { getCurrentUserScorePatterns } from "@zoonk/core/progress/get-score-patterns";
import { getSession } from "@zoonk/core/users/session";
import { PageSection, PageSectionHeader, PageSectionTitle } from "@zoonk/learn/page";
import { StatTile, StatTiles } from "@zoonk/learn/stat-tile";
import { BeltIndicator } from "@zoonk/ui/components/belt-indicator";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { formatMetricPercent, formatWholeNumber } from "@zoonk/utils/number";
import { ChartNoAxesColumnIncreasingIcon, TargetIcon, ZapIcon } from "lucide-react";
import { getExtracted, getFormatter, getLocale } from "next-intl/server";
import { ProgressEmptyState } from "../_components/progress-empty-state";
import { StatTilesSkeleton } from "../_components/stats-tiles";
import { ActivityChart, ActivityChartSkeleton } from "../activity/activity-chart";
import { ScoreChartSkeleton } from "../score/score-chart";
import { PatternsLinkRow, PatternsOverview, ScoreTrend } from "./overview-details";

const PERCENT = 100;

/** Four tiles a row from `sm`, two on phones. */
const TILES_CLASS = "gap-2 sm:grid-cols-4";

/**
 * A tile opens its stat's page: the whole tile is the link (its number carries it, stretched over
 * the tile), hovered as a row is.
 */
const TILE_LINK_CLASS =
  "focus-visible:ring-ring/50 rounded-sm outline-none after:absolute after:inset-0 after:rounded-option focus-visible:after:ring-[3px] focus-visible:after:ring-ring/50";

const TILE_CLASS = "hover:bg-muted/40 relative transition-colors";

/** Score and Patterns side by side from `lg`, stacked on a tablet; phones get one row instead. */
const DETAILS_CLASS =
  "hidden gap-8 md:grid lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:gap-10";

/** Counts inside a tile's line, in the mono face as every count reads. */
function renderCount(chunks: React.ReactNode) {
  return <span className="font-mono tabular-nums">{chunks}</span>;
}

/** A tile's number as the link to its stat's page, named with the tile's label and number. */
function TileLink<Href extends string>({
  href,
  label,
  value,
}: {
  href: AppRoute<Href>;
  label: string;
  value: string;
}) {
  return (
    <Link aria-label={`${label} ${value}`} className={TILE_LINK_CLASS} href={href} prefetch>
      {value}
    </Link>
  );
}

/** The belt's level, with the belt's name under it, opening the belt and what's ahead. */
async function LevelTile({ level }: { level: BeltLevelDetails }) {
  const t = await getExtracted();
  const belt = await getBeltLabel({ color: level.color });
  const label = t("Level");

  return (
    <StatTile
      className={TILE_CLASS}
      detail={belt}
      icon={<BeltIndicator aria-hidden color={level.color} label={belt} size="sm" />}
      label={label}
      value={<TileLink href={getMenu("level").url} label={label} value={String(level.level)} />}
    />
  );
}

/**
 * Energy now, or "Not yet" before a day of study has passed, with its average under it, opening
 * its year.
 */
async function EnergyTile({
  energy,
  started,
}: {
  energy: Pick<EnergyData, "currentEnergy" | "insights">;
  started: boolean;
}) {
  const t = await getExtracted();
  const format = await getFormatter();
  const label = t("Energy");
  const { insights } = energy;

  const value = started
    ? format.number(energy.currentEnergy / PERCENT, { maximumFractionDigits: 0, style: "percent" })
    : t("Not yet");

  return (
    <StatTile
      className={TILE_CLASS}
      detail={
        started && insights
          ? t("Average {value}", {
              value: formatMetricPercent({ format, value: insights.averageEnergy }),
            })
          : t("Starts after a day of study")
      }
      icon={<ZapIcon />}
      label={label}
      tone="energy"
      value={<TileLink href={getMenu("energy").url} label={label} value={value} />}
    />
  );
}

/** Study days, with the lessons and the time behind them, opening the year of them. */
async function StudyDaysTile({
  activity,
}: {
  activity: Awaited<ReturnType<typeof getLearningActivity>>;
}) {
  const t = await getExtracted();
  const format = await getFormatter();
  const label = t("Study days");

  const time = await getProgressLearningTimeLabel({
    totalSeconds: activity?.totalLearningSeconds ?? 0,
  });

  return (
    <StatTile
      className={TILE_CLASS}
      detail={t("{lessons, plural, =0 {# lessons} one {# lesson} other {# lessons}} · {time}", {
        lessons: activity?.totalLessonCompletions ?? 0,
        time,
      })}
      icon={<ChartNoAxesColumnIncreasingIcon />}
      label={label}
      tone="success"
      value={
        <TileLink
          href={getMenu("activity").url}
          label={label}
          value={formatWholeNumber({ format, value: activity?.learningDays ?? 0 })}
        />
      }
    />
  );
}

/** Right answers over 90 days, with the answers behind them, opening their weekly trend. */
async function ScoreTile({ progress }: { progress: CurrentUserProgress }) {
  const t = await getExtracted();
  const format = await getFormatter();
  const label = t("Score");
  const { score } = progress;

  const value = score ? formatMetricPercent({ format, value: score.score }) : t("Not yet");

  return (
    <StatTile
      className={TILE_CLASS}
      detail={
        score
          ? // "128/183 right", as the Score page's tile counts them.
            t.rich("<mono>{correct}/{total}</mono> right", {
              correct: formatWholeNumber({ format, value: score.correctAnswers }),
              mono: renderCount,
              total: formatWholeNumber({ format, value: score.totalAnswers }),
            })
          : t("Right answers in the last 90 days")
      }
      icon={<TargetIcon />}
      label={label}
      tone="success"
      value={<TileLink href={getMenu("score").url} label={label} value={value} />}
    />
  );
}

/**
 * Statistics at a glance, as a dashboard on a wide screen: four numbers on tiles (the level,
 * Energy, study days and right answers, each opening its page), the past 12 months of study across
 * the page, then Score's trend beside the best day and time (one row on a phone). Visitors and
 * learners who haven't studied yet get the same empty state as every stats page.
 */
export async function StatsOverview() {
  const locale = await getLocale();

  const [progress, session, energy, energyStarted, activity, patterns, history] = await Promise.all(
    [
      getCurrentUserProgress(),
      getSession(),
      loadOptionalData(getEnergyData),
      getEnergyStarted(),
      getLearningActivity(),
      loadOptionalData(getCurrentUserScorePatterns),
      loadOptionalData(() => getScoreHistory({ locale })),
    ],
  );

  if (!(progress && (progress.activity.learningDays > 0 || progress.level))) {
    return <ProgressEmptyState isAuthenticated={Boolean(session)} next={getMenu("stats").url} />;
  }

  const scorePatterns = patterns?.patterns ?? null;

  return (
    <div className="flex flex-col gap-8">
      <StatTiles className={TILES_CLASS}>
        {progress.level && <LevelTile level={progress.level} />}
        {energy && <EnergyTile energy={energy} started={energyStarted} />}
        <StudyDaysTile activity={activity} />
        <ScoreTile progress={progress} />
      </StatTiles>

      {activity && <ActivityChart days={activity.days} />}

      <div className={DETAILS_CLASS}>
        <ScoreTrend history={history} />
        <PatternsOverview patterns={scorePatterns} />
      </div>

      <PatternsLinkRow patterns={scorePatterns} />
    </div>
  );
}

/**
 * The overview at its size: the tiles, the calendar, then Score and Patterns under their own
 * titles (one row on a phone).
 */
export async function StatsOverviewSkeleton() {
  const t = await getExtracted();

  return (
    <div className="flex flex-col gap-8">
      <StatTilesSkeleton className="sm:grid-cols-4" count={4} />
      <ActivityChartSkeleton />
      <div className={DETAILS_CLASS}>
        <PageSection>
          <PageSectionHeader>
            <PageSectionTitle>{t("Score · 90 days")}</PageSectionTitle>
          </PageSectionHeader>
          <ScoreChartSkeleton />
        </PageSection>
        <PageSection>
          <PageSectionHeader>
            <PageSectionTitle>{t("Patterns · 90 days")}</PageSectionTitle>
          </PageSectionHeader>
          <Skeleton className="h-34 w-full rounded-lg" />
        </PageSection>
      </div>
      <Skeleton className="h-11 w-full rounded-lg md:hidden" />
    </div>
  );
}
