import { getAppLocale } from "@/i18n/locale";
import { type LearningActivityDay } from "@zoonk/core/progress/get-learning-activity";
import { type ChartPointDetail } from "@zoonk/ui/components/chart-inspector";
import { formatDuration } from "@zoonk/utils/duration";
import { getExtracted } from "next-intl/server";
import { getProgressDayFormatter } from "../_components/progress-insight-date-label";
import { StatsCalendar } from "../_components/stats-calendar";
import { getActivityCalendarIntensity } from "./_utils/activity-calendar-intensity";

const ACTIVITY_CHART_TITLE_ID = "activity-chart-title";

/** Blue means studied, as everywhere in the app. */
const INTENSITY_CLASSES = [
  "bg-surface-3",
  "bg-success/25",
  "bg-success/45",
  "bg-success/70",
  "bg-success",
] as const;

export async function ActivityChart({ days }: { days: LearningActivityDay[] }) {
  const [t, legend, locale] = await Promise.all([
    getExtracted(),
    getExtracted("activityLegend"),
    getAppLocale(),
  ]);

  const formatDay = getProgressDayFormatter({ locale, newest: days.at(-1)?.date });
  const maximumTimeSpentSeconds = Math.max(0, ...days.map((day) => day.timeSpentSeconds));

  const formatStudy = (day: LearningActivityDay): string => {
    if (day.activitiesCompleted === 0) {
      return t("No study");
    }

    const time =
      day.timeSpentSeconds > 0
        ? formatDuration({ locale, totalSeconds: day.timeSpentSeconds })
        : undefined;

    const lessons =
      day.lessonCompletions > 0
        ? t("{count, plural, one {# lesson} other {# lessons}}", { count: day.lessonCompletions })
        : undefined;

    return [time, lessons].filter(Boolean).join(" · ") || t("Studied");
  };

  const details = days.map((day): ChartPointDetail => [formatDay(day.date), formatStudy(day)]);

  const calendarDays = days.map((day) => {
    const intensity = getActivityCalendarIntensity({
      maximumTimeSpentSeconds,
      studied: day.activitiesCompleted > 0,
      timeSpentSeconds: day.timeSpentSeconds,
    });

    return {
      date: day.date,
      hasValue: day.activitiesCompleted > 0,
      intensityClass: INTENSITY_CLASSES.at(intensity) ?? INTENSITY_CLASSES[0],
    };
  });

  return (
    <StatsCalendar
      days={calendarDays}
      details={details}
      gridLabel={t("Activity by day")}
      legend={{
        classes: INTENSITY_CLASSES,
        high: legend({
          description: "The dark end of a heatmap's legend: more activity.",
          message: "More",
        }),
        label: legend({
          description: "Legend of a heatmap, from the lightest to the darkest squares.",
          message: "Activity from less to more",
        }),
        low: legend({
          description: "The light end of a heatmap's legend: less activity.",
          message: "Less",
        }),
        title: t("Study time"),
      }}
      titleId={ACTIVITY_CHART_TITLE_ID}
    />
  );
}
