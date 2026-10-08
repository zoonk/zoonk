import { Skeleton } from "@zoonk/ui/components/skeleton";
import { getExtracted, getFormatter } from "next-intl/server";
import { ProgressHeadline, ProgressHeadlineValue } from "../_components/progress-headline";

const PERCENT = 100;

/** Leads Energy with its value now, in whole percents like the top bar's buddy. */
export async function EnergyStats({ currentEnergy }: { currentEnergy: number }) {
  const format = await getFormatter();

  return (
    <ProgressHeadline>
      <ProgressHeadlineValue className="text-energy">
        {format.number(currentEnergy / PERCENT, { maximumFractionDigits: 0, style: "percent" })}
      </ProgressHeadlineValue>
    </ProgressHeadline>
  );
}

/** One sentence under the history: how Energy moves. */
export async function EnergyLine() {
  const t = await getExtracted();

  return (
    <p className="text-muted-foreground text-sm">
      {t("Energy rises when you study and drops a little on days off.")}
    </p>
  );
}

/** Mirrors the Energy headline while private data streams. */
export function EnergyStatsSkeleton() {
  return (
    <ProgressHeadline>
      <Skeleton className="h-12 w-28" />
    </ProgressHeadline>
  );
}
