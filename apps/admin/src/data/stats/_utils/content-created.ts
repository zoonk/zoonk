type ContentCountKey =
  | "audio"
  | "chapters"
  | "courses"
  | "examBlueprints"
  | "images"
  | "items"
  | "lessons"
  | "skills"
  | "sources"
  | "steps";

export type ContentCounts = Record<ContentCountKey, number>;
export type DailyContentRow = ContentCounts & { date: Date };
export type ContentCreatedSqlRow = { count: bigint; date: Date; type: string };

/** Builds every content count from one rule, so no type can be left out. */
function buildContentCounts(count: (key: ContentCountKey) => number): ContentCounts {
  return {
    audio: count("audio"),
    chapters: count("chapters"),
    courses: count("courses"),
    examBlueprints: count("examBlueprints"),
    images: count("images"),
    items: count("items"),
    lessons: count("lessons"),
    skills: count("skills"),
    sources: count("sources"),
    steps: count("steps"),
  };
}

/** Folds the per-type rows of the created-content union into one row per day. */
export function toDailyContentRows(rows: readonly ContentCreatedSqlRow[]): DailyContentRow[] {
  const byDay = Map.groupBy(rows, (row) => row.date.toISOString());

  return [...byDay.entries()]
    .map(([day, dayRows]) => ({
      ...buildContentCounts((key) =>
        dayRows.filter((row) => row.type === key).reduce((sum, row) => sum + Number(row.count), 0),
      ),
      date: new Date(day),
    }))
    .toSorted((a, b) => a.date.getTime() - b.date.getTime());
}

/**
 * Period totals are the sum of the same daily rows the charts draw, so a headline can never
 * disagree with its bars.
 */
export function sumContentCounts(rows: readonly ContentCounts[]): ContentCounts {
  return buildContentCounts((key) => rows.reduce((sum, row) => sum + row[key], 0));
}
