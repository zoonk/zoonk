import { getTotalDurationFormatter } from "@/lib/public/public-labels";
import { type DatedEstimate } from "@zoonk/core/catalog/course-plan-example-contract";
import { getExtracted } from "next-intl/server";

export type EstimateArea = DatedEstimate["areas"][number];

/** When none of its own lessons fit, it says what the area is studied through: "0 of 113 lessons fit" read as a contradiction. */
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
            t(
              "{fitting, plural, =0 {# of {total, number} lessons fit} one {# of {total, number} lessons fit} other {# of {total, number} lessons fit}}",
              { fitting: area.fitting, total: area.total },
            ),
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

export function findEstimateArea(
  estimate: DatedEstimate,
  area: string | null,
): EstimateArea | undefined {
  return estimate.areas.find((item) => item.area === area);
}
