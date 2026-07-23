import { Skeleton } from "@zoonk/ui/components/skeleton";
import { formatMetricPercent } from "@zoonk/utils/number";
import { getExtracted, getFormatter } from "next-intl/server";
import {
  ProgressHeadline,
  ProgressHeadlineLabel,
  ProgressHeadlineValue,
} from "../_components/progress-headline";

export async function EnergyStats({ currentEnergy }: { currentEnergy: number }) {
  const t = await getExtracted();
  const format = await getFormatter();

  const formattedCurrentEnergy = formatMetricPercent({ format, value: currentEnergy });

  return (
    <ProgressHeadline>
      <ProgressHeadlineLabel>{t("Current Energy")}</ProgressHeadlineLabel>
      <ProgressHeadlineValue className="text-energy">
        {formattedCurrentEnergy}
      </ProgressHeadlineValue>
    </ProgressHeadline>
  );
}

export function EnergyStatsSkeleton() {
  return (
    <ProgressHeadline>
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-12 w-28" />
    </ProgressHeadline>
  );
}
