import { getProgressLearningTimeLabel } from "@/components/progress/progress-learning-time-label";
import { type LearningActivityData } from "@zoonk/core/progress/get-learning-activity";
import { StatTile, StatTiles } from "@zoonk/learn/stat-tile";
import { formatWholeNumber } from "@zoonk/utils/number";
import { BookOpenCheckIcon, CalendarCheckIcon, ClockIcon } from "lucide-react";
import { getExtracted, getFormatter } from "next-intl/server";
import { STAT_PAGE_TILES_CLASS } from "../_components/stats-tiles";

export async function ActivityTiles({
  activity,
}: {
  activity: Pick<
    LearningActivityData,
    "learningDays" | "totalLearningSeconds" | "totalLessonCompletions"
  >;
}) {
  const t = await getExtracted();
  const format = await getFormatter();
  const time = await getProgressLearningTimeLabel({ totalSeconds: activity.totalLearningSeconds });

  return (
    <StatTiles className={STAT_PAGE_TILES_CLASS}>
      <StatTile
        icon={<CalendarCheckIcon />}
        label={t("Days studied")}
        tone="success"
        value={formatWholeNumber({ format, value: activity.learningDays })}
      />
      <StatTile
        icon={<BookOpenCheckIcon />}
        label={t("Lessons")}
        tone="success"
        value={formatWholeNumber({ format, value: activity.totalLessonCompletions })}
      />
      <StatTile icon={<ClockIcon />} label={t("Time")} tone="time" value={time} />
    </StatTiles>
  );
}
