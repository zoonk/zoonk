import { Link } from "@/i18n/navigation";
import { getMenu } from "@/lib/menu";
import { type getScoreHistory } from "@zoonk/core/progress/get-score-history";
import { type ScorePatternsData } from "@zoonk/core/progress/get-score-patterns";
import {
  ListGroup,
  ListRow,
  ListRowContent,
  ListRowLink,
  ListRowTitle,
  ListRowTrailing,
} from "@zoonk/learn/list";
import {
  PageSection,
  PageSectionDetail,
  PageSectionHeader,
  PageSectionTitle,
} from "@zoonk/learn/page";
import { buttonVariants } from "@zoonk/ui/components/button";
import { formatMetricPercent } from "@zoonk/utils/number";
import { ChevronRightIcon } from "lucide-react";
import { getExtracted, getFormatter } from "next-intl/server";
import { getCountedPatterns } from "../patterns/_utils/pattern-verdict";
import {
  PatternsNote,
  getBestDayName,
  getBestTimeName,
  getPatternsSummary,
} from "../patterns/pattern-summary";
import { ScoreChart } from "../score/score-chart";

const PERCENT = 100;

/** Score's weekly trend on a wide screen, under its window and its number. */
export async function ScoreTrend({
  history,
}: {
  history: Awaited<ReturnType<typeof getScoreHistory>> | null;
}) {
  const t = await getExtracted();
  const format = await getFormatter();

  return (
    <PageSection aria-labelledby="overview-score">
      <PageSectionHeader>
        <PageSectionTitle id="overview-score">{t("Score · 90 days")}</PageSectionTitle>
        {history && (
          <PageSectionDetail>
            {formatMetricPercent({ format, value: history.score })}
          </PageSectionDetail>
        )}
      </PageSectionHeader>

      {history ? (
        <ScoreChart dataPoints={history.dataPoints} performance={history} />
      ) : (
        <p className="text-muted-foreground text-sm">
          {t("Your score shows after your first answers.")}
        </p>
      )}
    </PageSection>
  );
}

/** "69–73%": the range the counted days span, in whole percents. */
async function getWeekSpread(patterns: ScorePatternsData): Promise<string | null> {
  const t = await getExtracted();
  const format = await getFormatter();
  const scores = getCountedPatterns(patterns.weekdays).map((day) => day.score / PERCENT);

  if (scores.length < 2) {
    return null;
  }

  const percent = (value: number) =>
    format.number(value, { maximumFractionDigits: 0, style: "percent" });

  return t("{low}–{high}", {
    high: percent(Math.max(...scores)),
    low: percent(Math.min(...scores)),
  });
}

/** One row of the patterns: what it is, and its answer on the right with its share, if any. */
function PatternsRow({
  label,
  score,
  value,
}: {
  label: string;
  score?: string | null;
  value: string;
}) {
  return (
    <ListRow>
      <ListRowContent>
        <ListRowTitle>{label}</ListRowTitle>
      </ListRowContent>
      <ListRowTrailing className="gap-3">
        <span className="text-foreground font-sans text-sm first-letter:uppercase">{value}</span>
        {score && <span>{score}</span>}
      </ListRowTrailing>
    </ListRow>
  );
}

/** The best group's share in whole percents, when one stands out. */
async function getBestScore(verdict: { best?: { score: number }; kind: string }) {
  const format = await getFormatter();

  return verdict.kind === "best" && verdict.best
    ? format.number(verdict.best.score / PERCENT, { maximumFractionDigits: 0, style: "percent" })
    : null;
}

/**
 * The best day and time on a wide screen, as rows (named only when one stands out), the range of
 * the week, and the honest lines under them, with the way to the full patterns.
 */
export async function PatternsOverview({ patterns }: { patterns: ScorePatternsData | null }) {
  const t = await getExtracted();
  const summary = patterns ? getPatternsSummary(patterns) : null;

  const day = summary ? await getBestDayName(summary.days) : null;
  const time = summary ? await getBestTimeName(summary.times) : null;
  const spread = patterns ? await getWeekSpread(patterns) : null;
  const dayScore = summary ? await getBestScore(summary.days) : null;
  const timeScore = summary ? await getBestScore(summary.times) : null;

  return (
    <PageSection aria-labelledby="overview-patterns">
      <PageSectionHeader>
        <PageSectionTitle id="overview-patterns">{t("Patterns · 90 days")}</PageSectionTitle>
        <Link
          className={buttonVariants({ className: "-my-1 -mr-2.5", size: "sm", variant: "ghost" })}
          href={getMenu("patterns").url}
          prefetch
        >
          {t("See all")}
          <ChevronRightIcon aria-hidden="true" data-icon="inline-end" />
        </Link>
      </PageSectionHeader>

      <ListGroup>
        <PatternsRow label={t("Best day")} score={dayScore} value={day ?? t("Not yet")} />
        <PatternsRow label={t("Best time")} score={timeScore} value={time ?? t("Not yet")} />
        {spread && <PatternsRow label={t("Spread across the week")} value={spread} />}
      </ListGroup>

      {summary && <PatternsNote summary={summary} />}
    </PageSection>
  );
}

/** On a phone, the patterns as one row: the best day and time, opening the full patterns. */
export async function PatternsLinkRow({ patterns }: { patterns: ScorePatternsData | null }) {
  const t = await getExtracted();
  const summary = patterns ? getPatternsSummary(patterns) : null;

  const day = summary ? await getBestDayName(summary.days) : null;
  const time = summary ? await getBestTimeName(summary.times) : null;

  const value = [day, time].filter(Boolean).join(" · ");

  return (
    <ListGroup className="md:hidden">
      <ListRowLink href={getMenu("patterns").url}>
        <ListRowContent>
          <ListRowTitle>{t("Patterns")}</ListRowTitle>
        </ListRowContent>
        <ListRowTrailing className="font-sans text-sm first-letter:uppercase">
          {value || t("Not yet")}
        </ListRowTrailing>
      </ListRowLink>
    </ListGroup>
  );
}
