import { getProgressDayCountLabel } from "@/components/progress/progress-day-count-label";
import { type ScorePerformance } from "@zoonk/core/progress/score-performance";
import { StatTile, StatTiles } from "@zoonk/learn/stat-tile";
import { formatMetricPercent, formatWholeNumber } from "@zoonk/utils/number";
import { CalendarRangeIcon, CheckIcon, TargetIcon } from "lucide-react";
import { getExtracted, getFormatter } from "next-intl/server";
import { STAT_PAGE_TILES_CLASS, StatsLine } from "../_components/stats-tiles";

const SCORE_WINDOW_DAYS = 90;

export async function ScoreTiles({ performance }: { performance: ScorePerformance }) {
  const t = await getExtracted();
  const format = await getFormatter();
  const correct = formatWholeNumber({ format, value: performance.correctAnswers });
  const total = formatWholeNumber({ format, value: performance.totalAnswers });

  return (
    <StatTiles className={STAT_PAGE_TILES_CLASS}>
      <StatTile
        detail={t("Right answers")}
        icon={<TargetIcon />}
        label={t("Score")}
        tone="success"
        value={formatMetricPercent({ format, value: performance.score })}
      />
      <StatTile
        detail={t("Of all your answers")}
        icon={<CheckIcon />}
        label={t("Right")}
        tone="success"
        value={
          <>
            <span aria-hidden="true">{`${correct}/${total}`}</span>
            <span className="sr-only">{t("{correct} of {total}", { correct, total })}</span>
          </>
        }
      />
      <StatTile
        detail={t("Back from today")}
        icon={<CalendarRangeIcon />}
        label={t("Period")}
        value={await getProgressDayCountLabel({ count: SCORE_WINDOW_DAYS })}
      />
    </StatTiles>
  );
}

export async function ScoreLine() {
  const t = await getExtracted();

  return (
    <StatsLine>
      {t("Every answer counts the same, so harder lessons can lower your score for a while.")}
    </StatsLine>
  );
}
