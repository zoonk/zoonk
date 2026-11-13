import { loadOptionalData } from "@/data/_utils/load-optional-data";
import { getAppLocale } from "@/i18n/locale";
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
import { getExtracted, getFormatter } from "next-intl/server";
import { ProgressEmptyState } from "../_components/progress-empty-state";
import { StatTilesSkeleton } from "../_components/stats-tiles";
import { ActivityChart, ActivityChartSkeleton } from "../activity/activity-chart";
import { ScoreChartSkeleton } from "../score/score-chart";
import { PatternsLinkRow, PatternsOverview, ScoreTrend } from "./overview-details";

const PERCENT = 100;

const TILES_CLASS = "gap-2 sm:grid-cols-4";

const TILE_LINK_CLASS =
  "focus-visible:ring-ring/50 rounded-sm outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-[3px] focus-visible:after:ring-ring/50";

const TILE_CLASS = "hover:bg-muted/40 relative transition-colors";

const DETAILS_CLASS =
  "hidden gap-8 md:grid lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:gap-10";

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

async function BeltTile({ level }: { level: BeltLevelDetails }) {
  const belt = await getBeltLabel({ color: level.color });

  return (
    <StatTile
      className={TILE_CLASS}
      icon={<BeltIndicator aria-hidden color={level.color} label={belt} size="sm" />}
      label={belt}
      value={<TileLink href={getMenu("level").url} label={belt} value={String(level.level)} />}
    />
  );
}

async function EnergyTile({ energy }: { energy: Pick<EnergyData, "currentEnergy"> }) {
  const t = await getExtracted();
  const format = await getFormatter();
  const label = t("Energy");

  const value = format.number(energy.currentEnergy / PERCENT, {
    maximumFractionDigits: 0,
    style: "percent",
  });

  return (
    <StatTile
      className={TILE_CLASS}
      icon={<ZapIcon />}
      label={label}
      tone="energy"
      value={<TileLink href={getMenu("energy").url} label={label} value={value} />}
    />
  );
}

async function StudyDaysTile({
  activity,
}: {
  activity: Awaited<ReturnType<typeof getLearningActivity>>;
}) {
  const t = await getExtracted();
  const format = await getFormatter();
  const label = t("Days studied");

  return (
    <StatTile
      className={TILE_CLASS}
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

async function ScoreTile({ progress }: { progress: CurrentUserProgress }) {
  const t = await getExtracted();
  const format = await getFormatter();
  const label = t("Right answers");
  const { score } = progress;
  const value = score ? formatMetricPercent({ format, value: score.score }) : "–";

  return (
    <StatTile
      className={TILE_CLASS}
      icon={<TargetIcon />}
      label={label}
      tone="success"
      value={<TileLink href={getMenu("score").url} label={label} value={value} />}
    />
  );
}

export async function StatsOverview() {
  const locale = await getAppLocale();

  const [progress, session, energy, activity, patterns, history] = await Promise.all([
    getCurrentUserProgress({ history: "lifetime" }),
    getSession(),
    loadOptionalData(getEnergyData),
    getLearningActivity({ history: "lifetime" }),
    loadOptionalData(() => getCurrentUserScorePatterns({ history: "lifetime" })),
    loadOptionalData(() => getScoreHistory({ history: "lifetime", locale })),
  ]);

  if (!(progress && (progress.activity.learningDays > 0 || progress.level))) {
    return <ProgressEmptyState isAuthenticated={Boolean(session)} next={getMenu("stats").url} />;
  }

  const scorePatterns = patterns?.patterns ?? null;

  return (
    <div className="flex flex-col gap-8">
      <StatTiles className={TILES_CLASS}>
        {progress.level && <BeltTile level={progress.level} />}
        {energy && <EnergyTile energy={energy} />}
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

export async function StatsOverviewSkeleton() {
  const t = await getExtracted();

  return (
    <div className="flex flex-col gap-8">
      <StatTilesSkeleton className="sm:grid-cols-4" count={4} />
      <ActivityChartSkeleton />
      <div className={DETAILS_CLASS}>
        <PageSection>
          <PageSectionHeader>
            <PageSectionTitle>{t("Right answers · 90 days")}</PageSectionTitle>
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
