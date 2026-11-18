import { type ScorePerformance } from "@zoonk/core/progress/score-performance";
import { BigQuantity } from "@zoonk/ui/components/big-quantity";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { Stat, StatDetail, StatValue } from "@zoonk/ui/components/stat";
import { DEFAULT_PROGRESS_LOOKBACK_DAYS } from "@zoonk/utils/date-ranges";
import { formatMetricPercent, formatWholeNumber } from "@zoonk/utils/number";
import { getExtracted, getFormatter } from "next-intl/server";

export async function ScoreTile({ performance }: { performance: ScorePerformance }) {
  const [t, format] = await Promise.all([getExtracted(), getFormatter()]);

  return (
    <Stat className="self-start">
      <StatValue>
        <BigQuantity>{formatMetricPercent({ format, value: performance.score })}</BigQuantity>
      </StatValue>
      <StatDetail>
        {t("{correct} of {total} right in the last {days} days", {
          correct: formatWholeNumber({ format, value: performance.correctAnswers }),
          days: String(DEFAULT_PROGRESS_LOOKBACK_DAYS),
          total: formatWholeNumber({ format, value: performance.totalAnswers }),
        })}
      </StatDetail>
    </Stat>
  );
}

export function ScoreTileSkeleton() {
  return (
    <Stat aria-hidden="true" className="self-start">
      <StatValue>
        <Skeleton className="w-14 rounded-sm">{"\u00A0"}</Skeleton>
      </StatValue>
      <StatDetail>
        <Skeleton className="block w-36 rounded-sm">{"\u00A0"}</Skeleton>
      </StatDetail>
    </Stat>
  );
}
