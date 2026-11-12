import { getProgressDayCountLabel } from "@/components/progress/progress-day-count-label";
import { type EnergyData } from "@zoonk/core/progress/energy";
import { StatTile, StatTiles } from "@zoonk/learn/stat-tile";
import { BatteryFullIcon, ZapIcon } from "lucide-react";
import { getExtracted, getFormatter } from "next-intl/server";

const PERCENT = 100;

const DASH = "–";

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
    <StatTiles>
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
      <StatTile icon={<BatteryFullIcon />} label={t("At 100%")} tone="energy" value={fullDays} />
    </StatTiles>
  );
}
