import { type PaceEstimate } from "@/components/catalog/plan-estimate";
import { getExtracted } from "next-intl/server";

/** One chapter's place in a pace's plan, as core's estimate gives it (both kinds of plan). */
export type ChapterWeeks = Pick<
  PaceEstimate["estimate"]["chapters"][number],
  "endWeek" | "week" | "workKinds"
>;

/**
 * How the outline writes a chapter's place in the plan, read once for a page that writes many: the
 * week it starts ("Week 18"), null when the plan holds nothing of it. The plan studies chapters
 * side by side, so a chapter running on to week 2 sits above one done in week 1; a range there
 * ("Weeks 1–2" over "Week 1") read as the outline being out of order, while the weeks they start
 * only ever go up. A level's span still runs to its last chapter's last week.
 */
export async function getChapterWeeksFormatter(): Promise<(row: ChapterWeeks) => string | null> {
  const t = await getExtracted();

  return function formatWeeks(row: ChapterWeeks): string | null {
    return row.week ? t("Week {week, number}", { week: row.week }) : null;
  };
}

/**
 * What a chapter none of whose own lessons fit is studied through, from the plan's work kinds:
 * quick lessons that stand in for them, lessons still to be written, or both. Null when its own
 * lessons are in the plan.
 */
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
