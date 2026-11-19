import { type ScorePerformance } from "@zoonk/core/progress/score-performance";
import { StatTile, StatTiles } from "@zoonk/learn/stat-tile";
import { DEFAULT_PROGRESS_LOOKBACK_DAYS } from "@zoonk/utils/date-ranges";
import { formatMetricPercent, formatWholeNumber } from "@zoonk/utils/number";
import { getExtracted, getFormatter } from "next-intl/server";
import { StatTilesSkeleton } from "../_components/stats-tiles";

export async function ScoreTile({ performance }: { performance: ScorePerformance }) {
  const [t, format] = await Promise.all([getExtracted(), getFormatter()]);

  return (
    <StatTiles>
      <StatTile
        detail={t("{correct} of {total} right in the last {days} days", {
          correct: formatWholeNumber({ format, value: performance.correctAnswers }),
          days: String(DEFAULT_PROGRESS_LOOKBACK_DAYS),
          total: formatWholeNumber({ format, value: performance.totalAnswers }),
        })}
        value={formatMetricPercent({ format, value: performance.score })}
      />
    </StatTiles>
  );
}

export function ScoreTileSkeleton() {
  return <StatTilesSkeleton count={1} detailed={1} labeled={false} />;
}
