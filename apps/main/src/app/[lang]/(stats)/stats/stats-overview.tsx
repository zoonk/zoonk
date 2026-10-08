import { getProgressDayCountLabel } from "@/components/progress/progress-day-count-label";
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
import { getSession } from "@zoonk/core/users/session";
import { SURFACE_CLASS } from "@zoonk/learn/surface";
import { BeltIndicator, beltColorClasses } from "@zoonk/ui/components/belt-indicator";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { cn } from "@zoonk/ui/lib/utils";
import { groupContributionCalendarDaysByWeek } from "@zoonk/utils/contribution-calendar";
import { formatMetricPercent, formatWholeNumber } from "@zoonk/utils/number";
import { ChevronRightIcon } from "lucide-react";
import { getExtracted, getFormatter, getLocale } from "next-intl/server";
import { ProgressEmptyState } from "../_components/progress-empty-state";
import { type StatsMetric, StatsMetricTile } from "../_components/stats-metric-tile";
import { getEnergyCalendarIntensity } from "../energy/_utils/energy-calendar-intensity";
import { ENERGY_INTENSITY_CLASSES } from "../energy/energy-chart";
import { getScoreWeekdayLabel } from "../patterns/_utils/weekday";

const PERCENT = 100;

/** Weeks of Energy at a glance: the last 16 on phones, 26 from `sm`, newest on the right. */
const GLANCE_WEEKS = 26;
const PHONE_GLANCE_WEEKS = 16;

const CARD_CLASS = cn(
  SURFACE_CLASS,
  "hover:bg-muted/40 focus-visible:ring-ring/50 flex flex-col gap-3 p-4 transition-colors outline-none focus-visible:ring-[3px]",
);

/** Every stat's number has its stat's color, as on its page. */
const VALUE_TONE: Readonly<Record<StatsMetric, string>> = {
  activity: "text-info",
  energy: "text-energy",
  level: "text-foreground",
  patterns: "text-score",
  score: "text-score",
};

/**
 * One stat as a card of the overview: its tile, name and chevron, then its number big in its
 * color, one line on what the number means and, for some, a glance (the belt's bar, Energy's last
 * weeks). The card opens the stat's page.
 */
function StatCard<Href extends string>({
  children,
  href,
  label,
  lead,
  metric,
  note,
  value,
  valueClassName,
}: {
  children?: React.ReactNode;
  href: AppRoute<Href>;
  label: string;
  lead: React.ReactNode;
  metric: StatsMetric;
  note: string | null;
  value: string;
  valueClassName?: string;
}) {
  return (
    <Link className={CARD_CLASS} href={href} prefetch>
      <span className="flex items-center gap-2.5">
        {lead}
        <span className="flex-1 text-[0.9375rem] font-semibold">{label}</span>
        <ChevronRightIcon aria-hidden="true" className="text-muted-foreground/60 size-4 shrink-0" />
      </span>

      <span className="flex flex-col gap-0.5">
        <span
          className={cn(
            "text-3xl font-bold tracking-tight tabular-nums first-letter:uppercase",
            VALUE_TONE[metric],
            valueClassName,
          )}
        >
          {value}
        </span>
        {note && <span className="text-muted-foreground text-sm">{note}</span>}
      </span>

      {children}
    </Link>
  );
}

/** How far into the current level, as a share for the belt's bar. */
function getLevelShare(level: BeltLevelDetails): number {
  return level.isMaxLevel ? 1 : level.progressInLevel / level.bpPerLevel;
}

/** The belt leads Statistics: its name and level, how far the next level is, and its bar. */
async function LevelCard({ level }: { level: BeltLevelDetails }) {
  const [t, format] = await Promise.all([getExtracted(), getFormatter()]);
  const belt = await getBeltLabel({ color: level.color });

  return (
    <StatCard
      href={getMenu("level").url}
      label={t("Level")}
      lead={<BeltIndicator aria-hidden className="size-8" color={level.color} label={belt} />}
      metric="level"
      note={
        level.isMaxLevel
          ? t("Max level reached")
          : t("{value} Brain Power to the next level", {
              value: formatWholeNumber({ format, value: level.bpToNextLevel }),
            })
      }
      value={t("{belt} · level {level}", { belt, level: String(level.level) })}
      valueClassName="text-2xl text-balance"
    >
      <span aria-hidden="true" className="bg-muted h-1.5 overflow-hidden rounded-full">
        <span
          className={cn(
            "block h-full rounded-full",
            beltColorClasses[level.color],
            level.color === "white" && "ring-border ring-1 ring-inset",
          )}
          style={{ width: `${getLevelShare(level) * PERCENT}%` }}
        />
      </span>
    </StatCard>
  );
}

/**
 * The last weeks of Energy as a small heatmap, one square a day in its Energy's shade, the newest
 * on the right and the oldest cut where the card ends. Decorative: the card says Energy now, and
 * its page has the whole year with every day's value.
 */
function EnergyGlance({ days }: { days: EnergyData["days"] }) {
  const weeks = groupContributionCalendarDaysByWeek(days).slice(-GLANCE_WEEKS);
  const phoneStart = weeks.length - PHONE_GLANCE_WEEKS;

  return (
    <span aria-hidden="true" className="flex justify-end gap-0.75 overflow-hidden">
      {weeks.map((week, index) => (
        <span
          className={cn(
            "shrink-0 flex-col gap-0.75",
            index < phoneStart ? "hidden sm:flex" : "flex",
          )}
          key={week[0]?.date.toISOString() ?? index}
        >
          {week.map((day) => (
            <span
              className={cn(
                "size-3 rounded-[3px]",
                ENERGY_INTENSITY_CLASSES.at(getEnergyCalendarIntensity(day.energy)),
              )}
              key={day.date.toISOString()}
            />
          ))}
        </span>
      ))}
    </span>
  );
}

/**
 * Before a day of study has passed, Energy has nothing to say yet: when it starts, as the buddy
 * says it (`getEnergyStarted`), instead of a first day's few percent.
 */
async function EnergyStartsCard() {
  const t = await getExtracted();

  return (
    <StatCard
      href={getMenu("energy").url}
      label={t("Energy")}
      lead={<StatsMetricTile className="size-8 rounded-lg" metric="energy" />}
      metric="energy"
      note={t("Energy starts after your first day of study, and grows as you learn.")}
      value={t("Not yet")}
      valueClassName="text-muted-foreground text-2xl"
    />
  );
}

/** Energy now, with its last weeks at a glance, opening its whole year. */
async function EnergyCard({ energy }: { energy: EnergyData }) {
  const [t, format] = await Promise.all([getExtracted(), getFormatter()]);

  return (
    <StatCard
      href={getMenu("energy").url}
      label={t("Energy")}
      lead={<StatsMetricTile className="size-8 rounded-lg" metric="energy" />}
      metric="energy"
      note={t("Energy rises when you study and drops a little on days off.")}
      value={format.number(energy.currentEnergy / PERCENT, {
        maximumFractionDigits: 0,
        style: "percent",
      })}
    >
      <EnergyGlance days={energy.days} />
    </StatCard>
  );
}

/** The part of the day the learner answers best in, by name. */
async function getBestTimeLabel(progress: CurrentUserProgress): Promise<string | null> {
  const t = await getExtracted();
  const period = progress.scorePatterns?.strongestTime?.period;

  if (period === undefined) {
    return null;
  }

  return [t("Night"), t("Morning"), t("Afternoon"), t("Evening")].at(period) ?? null;
}

/** Study days, with the lessons and time behind them. */
async function ActivityCard({ progress }: { progress: CurrentUserProgress }) {
  const t = await getExtracted();
  const { learningDays, totalLearningSeconds, totalLessonCompletions } = progress.activity;
  const time = await getProgressLearningTimeLabel({ totalSeconds: totalLearningSeconds });

  return (
    <StatCard
      href={getMenu("activity").url}
      label={t("Activity")}
      lead={<StatsMetricTile className="size-8 rounded-lg" metric="activity" />}
      metric="activity"
      note={t(
        "{lessons, plural, =0 {# lessons} one {# lesson} other {# lessons}} · {time} in total",
        { lessons: totalLessonCompletions, time },
      )}
      value={await getProgressDayCountLabel({ count: learningDays })}
    />
  );
}

/** Right answers, as the score's page counts them. */
async function ScoreCard({ progress }: { progress: CurrentUserProgress }) {
  const [t, format] = await Promise.all([getExtracted(), getFormatter()]);

  return (
    <StatCard
      href={getMenu("score").url}
      label={t("Score")}
      lead={<StatsMetricTile className="size-8 rounded-lg" metric="score" />}
      metric="score"
      note={t("Right answers in the last 90 days")}
      value={
        progress.score ? formatMetricPercent({ format, value: progress.score.score }) : t("Not yet")
      }
      valueClassName={progress.score ? undefined : "text-muted-foreground text-2xl"}
    />
  );
}

/** The learner's best day and part of the day, together. */
async function PatternsCard({ progress }: { progress: CurrentUserProgress }) {
  const [t, locale] = await Promise.all([getExtracted(), getLocale()]);
  const bestDay = progress.scorePatterns?.strongestWeekday;
  const day = bestDay ? getScoreWeekdayLabel({ dayOfWeek: bestDay.dayOfWeek, locale }) : null;
  const time = await getBestTimeLabel(progress);
  const value = [day, time].filter(Boolean).join(" · ");

  return (
    <StatCard
      href={getMenu("patterns").url}
      label={t("Patterns")}
      lead={<StatsMetricTile className="size-8 rounded-lg" metric="patterns" />}
      metric="patterns"
      note={t("Your best day and time")}
      value={value || t("Not yet")}
      valueClassName={cn("text-2xl", !value && "text-muted-foreground")}
    />
  );
}

/**
 * Statistics at a glance, one card per stat: the belt leading, Energy with its last weeks, study
 * days, right answers and the learner's best day and time, each opening the page with its chart.
 * Visitors and learners who haven't studied yet get the same empty state as every stats page.
 */
export async function StatsOverview() {
  const [progress, session, energy, energyStarted] = await Promise.all([
    getCurrentUserProgress(),
    getSession(),
    loadOptionalData(getEnergyData),
    getEnergyStarted(),
  ]);

  if (!(progress && (progress.activity.learningDays > 0 || progress.level))) {
    return <ProgressEmptyState isAuthenticated={Boolean(session)} />;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {progress.level && <LevelCard level={progress.level} />}
      {energy && (energyStarted ? <EnergyCard energy={energy} /> : <EnergyStartsCard />)}
      <ActivityCard progress={progress} />
      <ScoreCard progress={progress} />
      <PatternsCard progress={progress} />
    </div>
  );
}

export function StatsOverviewSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {["level", "energy", "activity", "score", "patterns"].map((key) => (
        <Skeleton className="h-36 rounded-2xl" key={key} />
      ))}
    </div>
  );
}
