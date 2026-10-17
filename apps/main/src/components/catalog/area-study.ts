import { getTotalDurationFormatter } from "@/lib/public/public-labels";
import { getExtracted } from "next-intl/server";
import { type DatedEstimate } from "./plan-estimate";

/** One exam area in a plan against the exam's date, at one time a day. */
export type EstimateArea = DatedEstimate["areas"][number];

/**
 * How an exam area reads in a plan, at one time a day: the study time it gets first (its lessons,
 * quick ones and those still to be written; reviews and practice aside), then what fills it: how
 * many of the course's lessons fit, with the quick lessons that stand in for others, or, when none
 * of its own lessons fit, what it's studied through instead ("0 of 113 lessons fit" beside its
 * minutes read as a contradiction). Only an area with no time at all is left out.
 */
export async function getAreaStudyText(): Promise<
  (area: EstimateArea) => { detail: string; studied: boolean; time: string }
> {
  const t = await getExtracted();
  const durationText = await getTotalDurationFormatter();

  const quickText = (count: number) =>
    t("{count, plural, one {# quick lesson} other {# quick lessons}}", { count });

  const throughText = (area: EstimateArea) => {
    const quick = area.quickLessons > 0;
    const unwritten = Math.round(area.unwrittenMinutes) > 0;

    if (quick && unwritten) {
      return t("quick lessons and lessons written as you reach them");
    }

    return quick ? quickText(area.quickLessons) : t("lessons written as you reach them");
  };

  return (area) => {
    const studied = Math.round(area.plannedMinutes) > 0;

    const detail =
      studied && area.fitting === 0
        ? throughText(area)
        : [
            t("{fitting, number} of {total, number} lessons fit", {
              fitting: area.fitting,
              total: area.total,
            }),
            area.quickLessons > 0 &&
              t("{count, plural, one {+ # quick lesson} other {+ # quick lessons}}", {
                count: area.quickLessons,
              }),
          ]
            .filter(Boolean)
            .join(" · ");

    return {
      detail,
      studied,
      time: studied
        ? t("{time} of study", { time: durationText(area.plannedMinutes) })
        : t("Left out"),
    };
  };
}

/** The area's entry in a pace's plan; core names an unknown area null. */
export function findEstimateArea(
  estimate: DatedEstimate,
  area: string | null,
): EstimateArea | undefined {
  return estimate.areas.find((item) => item.area === area);
}
