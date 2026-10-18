import { getProgressLearningTimeLabel } from "@/components/progress/progress-learning-time-label";
import { type LearningActivityData } from "@zoonk/core/progress/get-learning-activity";
import { StatTile, StatTiles } from "@zoonk/learn/stat-tile";
import { formatWholeNumber } from "@zoonk/utils/number";
import { BookOpenCheckIcon, CalendarCheckIcon, ClockIcon } from "lucide-react";
import { getExtracted, getFormatter } from "next-intl/server";
import { STAT_PAGE_TILES_CLASS } from "../_components/stats-tiles";

/**
 * Activity's three numbers: the study days (the days the calendar lights), the lessons finished
 * and the time it all took.
 */
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
        detail={t("Any day you studied")}
        icon={<CalendarCheckIcon />}
        label={t("Study days")}
        tone="success"
        value={formatWholeNumber({ format, value: activity.learningDays })}
      />
      <StatTile
        // Its own message, by the count: "Finished" agrees with the lessons in each language
        // ("Concluídas"), not with a goal ("Concluído").
        detail={t("{count, plural, =0 {Finished} one {Finished} other {Finished}}", {
          count: activity.totalLessonCompletions,
        })}
        icon={<BookOpenCheckIcon />}
        label={t("Lessons")}
        tone="success"
        value={formatWholeNumber({ format, value: activity.totalLessonCompletions })}
      />
      <StatTile
        detail={t("Studying in total")}
        icon={<ClockIcon />}
        label={t("Time")}
        tone="time"
        value={time}
      />
    </StatTiles>
  );
}
