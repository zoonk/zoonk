import { type PaceEstimate } from "@zoonk/core/catalog/course-plan-example-contract";
import { getExtracted } from "next-intl/server";

export type ChapterWeeks = Pick<
  PaceEstimate["estimate"]["chapters"][number],
  "endWeek" | "week" | "workKinds"
>;

/**
 * Only the week a chapter starts: the plan studies chapters side by side, so ranges ("Weeks 1–2"
 * over "Week 1") read as the outline being out of order.
 */
export async function getChapterWeeksFormatter(): Promise<(row: ChapterWeeks) => string | null> {
  const t = await getExtracted();

  return function formatWeeks(row: ChapterWeeks): string | null {
    return row.week ? t("Week {week, number}", { week: row.week }) : null;
  };
}

export async function getChapterWorkFormatter(): Promise<(row: ChapterWeeks) => string | null> {
  const t = await getExtracted();

  return function formatWork(row: ChapterWeeks): string | null {
    const quick = row.workKinds.includes("quick");
    const unwritten = row.workKinds.includes("unwritten");

    if (quick && unwritten) {
      return t("quick lessons and lessons written as you reach them");
    }

    if (quick) {
      return t("quick lessons");
    }

    return unwritten ? t("lessons written as you reach them") : null;
  };
}
