import { getProgressDayCountLabel } from "@/components/progress/progress-day-count-label";
import { type EnergyData } from "@zoonk/core/progress/energy";
import { StatTile, StatTiles } from "@zoonk/learn/stat-tile";
import { formatMetricPercent } from "@zoonk/utils/number";
import { BatteryFullIcon, GaugeIcon, ZapIcon } from "lucide-react";
import { getExtracted, getFormatter } from "next-intl/server";
import { STAT_PAGE_TILES_CLASS, StatsLine } from "../_components/stats-tiles";

const PERCENT = 100;

/** A value the history doesn't have yet. */
const DASH = "–";

/**
 * Energy's three numbers: its value now (in whole percents, as the buddy shows it), its average
 * over the learner's history and the days it was full.
 */
export async function EnergyTiles({
  currentEnergy,
  insights,
}: {
  currentEnergy: number;
  insights: EnergyData["insights"];
}) {
  const t = await getExtracted();
  const format = await getFormatter();

  const fullDays = insights
    ? await getProgressDayCountLabel({ count: insights.fullEnergyDays })
    : DASH;

  return (
    <StatTiles className={STAT_PAGE_TILES_CLASS}>
      <StatTile
        detail={t("Today")}
        icon={<ZapIcon />}
        label={t("Energy")}
        tone="energy"
        value={format.number(currentEnergy / PERCENT, {
          maximumFractionDigits: 0,
          style: "percent",
        })}
      />
      <StatTile
        detail={t("Since you started")}
        icon={<GaugeIcon />}
        label={t("Average")}
        tone="energy"
        value={insights ? formatMetricPercent({ format, value: insights.averageEnergy }) : DASH}
      />
      <StatTile
        detail={t("Days with full Energy")}
        icon={<BatteryFullIcon />}
        label={t("At 100%")}
        tone="energy"
        value={fullDays}
      />
    </StatTiles>
  );
}

/** One line under the year: how Energy moves, and what never does. */
export async function EnergyLine() {
  const t = await getExtracted();

  return (
    <StatsLine>
      {t(
        "Every lesson you finish raises your Energy. On days off it drops a little, and your belt and progress stay.",
      )}
    </StatsLine>
  );
}
