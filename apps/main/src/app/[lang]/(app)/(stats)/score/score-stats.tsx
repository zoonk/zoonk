import { type ScorePerformance } from "@zoonk/core/progress/score-performance";
import { StatTile, StatTiles } from "@zoonk/learn/stat-tile";
import { formatMetricPercent, formatWholeNumber } from "@zoonk/utils/number";
import { TargetIcon } from "lucide-react";
import { getExtracted, getFormatter } from "next-intl/server";

const SCORE_WINDOW_DAYS = 90;

export async function ScoreTile({ performance }: { performance: ScorePerformance }) {
  const t = await getExtracted();
  const format = await getFormatter();

  return (
    <StatTiles>
      <StatTile
        detail={t("{correct} of {total}", {
          correct: formatWholeNumber({ format, value: performance.correctAnswers }),
          total: formatWholeNumber({ format, value: performance.totalAnswers }),
        })}
        icon={<TargetIcon />}
        label={t("Last {days} days", { days: String(SCORE_WINDOW_DAYS) })}
        tone="success"
        value={formatMetricPercent({ format, value: performance.score })}
      />
    </StatTiles>
  );
}
