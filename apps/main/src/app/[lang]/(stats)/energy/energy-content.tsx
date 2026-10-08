import { loadOptionalData } from "@/data/_utils/load-optional-data";
import { getEnergyData } from "@zoonk/core/progress/get-energy-data";
import { getEnergyStarted } from "@zoonk/core/progress/get-energy-started";
import { getSession } from "@zoonk/core/users/session";
import {
  ListGroup,
  ListRow,
  ListRowContent,
  ListRowDescription,
  ListRowLeading,
  ListRowTitle,
} from "@zoonk/learn/list";
import { PageSection, PageSectionHeader, PageSectionTitle } from "@zoonk/learn/page";
import { Surface } from "@zoonk/learn/surface";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { getExtracted } from "next-intl/server";
import { ProgressContent } from "../_components/progress-content";
import { ProgressEmptyState } from "../_components/progress-empty-state";
import { StatsMetricTile } from "../_components/stats-metric-tile";
import { EnergyChart, EnergyChartSkeleton } from "./energy-chart";
import { EnergyInsights, EnergyInsightsSkeleton } from "./energy-insights";
import { EnergyLine, EnergyStats, EnergyStatsSkeleton } from "./energy-stats";

/**
 * Before a day of study has passed, Energy has nothing to say yet: when it starts, as the buddy
 * says it, instead of a first day's few percent.
 */
async function EnergyStartsState() {
  const t = await getExtracted();

  return (
    <ProgressContent>
      <div className="text-muted-foreground flex min-h-64 flex-col items-center justify-center gap-4 rounded-xl border border-dashed p-4 text-center text-balance">
        {t("Energy starts after your first day of study, and grows as you learn.")}
      </div>
    </ProgressContent>
  );
}

/** "How to raise it": the one habit that moves Energy, as a row under its header. */
async function EnergyHowTo() {
  const t = await getExtracted();

  return (
    <PageSection aria-labelledby="energy-how-to">
      <PageSectionHeader>
        <PageSectionTitle id="energy-how-to">{t("How to raise it")}</PageSectionTitle>
      </PageSectionHeader>
      <ListGroup>
        <ListRow>
          <ListRowLeading>
            <StatsMetricTile className="size-10 rounded-xl" metric="energy" />
          </ListRowLeading>
          <ListRowContent>
            <ListRowTitle>{t("Study a little every day")}</ListRowTitle>
            <ListRowDescription>
              {t(
                "Every lesson you finish raises it. On days off it drops a little, and your belt and progress stay.",
              )}
            </ListRowDescription>
          </ListRowContent>
        </ListRow>
      </ListGroup>
    </PageSection>
  );
}

/**
 * Energy: its value now with one line on how it moves, the past 12 months as a heatmap, its
 * average and the days at its maximum, and how to raise it. Nothing until a day of study has
 * passed (`getEnergyStarted`).
 */
export async function EnergyContent() {
  const [data, session, started] = await Promise.all([
    loadOptionalData(getEnergyData),
    getSession(),
    getEnergyStarted(),
  ]);

  if (!(data && session)) {
    return <ProgressEmptyState isAuthenticated={Boolean(session)} />;
  }

  if (!started) {
    return <EnergyStartsState />;
  }

  return (
    <ProgressContent>
      <div className="flex flex-col gap-2 px-1">
        <EnergyStats currentEnergy={data.currentEnergy} />
        <EnergyLine />
      </div>
      <Surface className="p-4">
        <EnergyChart days={data.days} />
      </Surface>
      <EnergyInsights insights={data.insights} />
      <EnergyHowTo />
    </ProgressContent>
  );
}

export function EnergyContentSkeleton() {
  return (
    <ProgressContent>
      <EnergyStatsSkeleton />
      <Surface className="p-4">
        <EnergyChartSkeleton />
      </Surface>
      <EnergyInsightsSkeleton />
      <Skeleton className="h-4 w-72 max-w-full" />
    </ProgressContent>
  );
}
