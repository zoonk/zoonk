import { Link } from "@/i18n/navigation";
import { getMenu } from "@/lib/menu";
import { type getScoreHistory } from "@zoonk/core/progress/get-score-history";
import { type ScorePatternsData } from "@zoonk/core/progress/get-score-patterns";
import { toLabelCase } from "@zoonk/learn/label-case";
import {
  ListGroup,
  ListRow,
  ListRowBody,
  ListRowContent,
  ListRowDescription,
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
import { getBestDayName, getBestTimeName } from "../patterns/pattern-summary";
import { ScoreChart } from "../score/score-chart";
import { OVERVIEW_CHART_MEDIA } from "./overview-chart-media";

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
        <ScoreChart
          dataPoints={history.dataPoints}
          media={OVERVIEW_CHART_MEDIA}
          performance={history}
        />
      ) : (
        <p className="text-muted-foreground text-sm">{t("Shows after your first answers.")}</p>
      )}
    </PageSection>
  );
}

function PatternsRow({ label, value }: { label: string; value: string }) {
  return (
    <ListRow>
      <ListRowBody>
        <ListRowContent>
          <ListRowTitle>{label}</ListRowTitle>
        </ListRowContent>
        <ListRowTrailing className="text-foreground font-sans text-sm">{value}</ListRowTrailing>
      </ListRowBody>
    </ListRow>
  );
}

async function getPatternValues(patterns: ScorePatternsData | null) {
  const t = await getExtracted();
  const day = patterns ? await getBestDayName(patterns.dayVerdict) : null;
  const time = patterns ? await getBestTimeName(patterns.timeVerdict) : null;

  return {
    day: toLabelCase(day ?? t("Not yet")),
    dayLabel: t("Best day"),
    needsAnswers:
      !patterns || [patterns.dayVerdict.kind, patterns.timeVerdict.kind].includes("notEnough"),
    time: toLabelCase(time ?? t("Not yet")),
    timeLabel: t("Best time"),
  };
}

export async function PatternsOverview({ patterns }: { patterns: ScorePatternsData | null }) {
  const t = await getExtracted();

  const { day, dayLabel, needsAnswers, time, timeLabel } = await getPatternValues(patterns);

  return (
    <PageSection aria-labelledby="overview-patterns">
      <PageSectionHeader>
        <PageSectionTitle id="overview-patterns">{t("Patterns · 90 days")}</PageSectionTitle>
        <Link
          className={buttonVariants({
            className: "-my-1",
            edge: "end",
            size: "sm",
            variant: "ghost",
          })}
          href={getMenu("patterns").url}
          prefetch
        >
          {t("See all")}
          <ChevronRightIcon aria-hidden="true" data-icon="inline-end" />
        </Link>
      </PageSectionHeader>

      <ListGroup>
        <PatternsRow label={dayLabel} value={day} />
        <PatternsRow label={timeLabel} value={time} />
      </ListGroup>
      {needsAnswers && (
        <p className="text-muted-foreground text-sm">
          {t("Answer more questions to see when you do best.")}
        </p>
      )}
    </PageSection>
  );
}

export async function PatternsLinkRow({ patterns }: { patterns: ScorePatternsData | null }) {
  const t = await getExtracted();

  const { day, dayLabel, needsAnswers, time, timeLabel } = await getPatternValues(patterns);

  return (
    <div className="flex flex-col gap-2 md:hidden">
      <ListGroup>
        <ListRowLink href={getMenu("patterns").url}>
          <ListRowBody>
            <ListRowContent>
              <ListRowTitle>{t("Patterns")}</ListRowTitle>
              <ListRowDescription>{`${dayLabel} · ${day}`}</ListRowDescription>
              <ListRowDescription>{`${timeLabel} · ${time}`}</ListRowDescription>
            </ListRowContent>
          </ListRowBody>
        </ListRowLink>
      </ListGroup>
      {needsAnswers && (
        <p className="text-muted-foreground text-sm">
          {t("Answer more questions to see when you do best.")}
        </p>
      )}
    </div>
  );
}
