import { findEstimateArea, getAreaStudyText } from "@/components/catalog/area-study";
import { type LibraryOutline } from "@/data/catalog/resolve-catalog-route";
import { type DatedEstimate } from "@zoonk/core/catalog/course-plan-example-contract";
import { RouteZone } from "@zoonk/learn/route-line";
import { getExtracted } from "next-intl/server";
import {
  OUTLINE_SEPARATOR,
  type OutlineChapter,
  OutlineChapterList,
  OutlineChapterRow,
  type OutlineParams,
} from "./outline-chapter-row";
import { getChapterWeeksFormatter, getChapterWorkFormatter } from "./outline-weeks";

type ChapterRow = DatedEstimate["chapters"][number];

type AreaRows = ReadonlyMap<string, ChapterRow>;

function orderByStudy({ chapters, rows }: { chapters: OutlineChapter[]; rows: AreaRows }) {
  const order = (chapter: OutlineChapter) =>
    rows.get(chapter.id)?.studyOrder ?? Number.POSITIVE_INFINITY;

  return chapters.toSorted((first, second) => order(first) - order(second));
}

/** No bar: a share of time would read as coverage. */
async function AreaFit({
  area,
  chapters,
  estimate,
  rows,
}: {
  area: string | null;
  chapters: OutlineChapter[];
  estimate: DatedEstimate;
  rows: AreaRows;
}) {
  const t = await getExtracted();
  const areaText = await getAreaStudyText();

  const entry = findEstimateArea(estimate, area);
  const text = entry ? areaText(entry) : null;

  const leftOut = chapters.filter(
    (chapter) => (rows.get(chapter.id)?.week ?? null) === null,
  ).length;

  return (
    <span className="flex flex-col gap-1.5">
      <span className="text-muted-foreground text-[13px] leading-snug font-normal sm:text-sm">
        {[
          text?.time,
          text?.detail,
          leftOut > 0 &&
            leftOut < chapters.length &&
            t("{count, plural, one {# chapter left out} other {# chapters left out}}", {
              count: leftOut,
            }),
        ]
          .filter(Boolean)
          .join(OUTLINE_SEPARATOR)}
      </span>
    </span>
  );
}

async function AreaChapters({
  chapters,
  numbers,
  params,
  rows,
}: {
  chapters: OutlineChapter[];
  numbers: Map<string, number>;
  params: OutlineParams;
  rows: AreaRows;
}) {
  const t = await getExtracted();

  const weeksText = await getChapterWeeksFormatter();
  const workText = await getChapterWorkFormatter();

  /** "Left out" only when the plan holds no work of it. */
  const markText = (chapter: OutlineChapter) => {
    const row = rows.get(chapter.id);
    const span = row ? weeksText(row) : null;

    if (!row || !span) {
      return t("Left out");
    }

    const detail =
      row.lessonsInPlan === 0
        ? workText(row)
        : row.lessonsInPlan < chapter.lessons.length &&
          t(
            "{count, plural, =0 {# of {total, number} lessons} one {# of {total, number} lessons} other {# of {total, number} lessons}}",
            { count: row.lessonsInPlan, total: chapter.lessons.length },
          );

    return detail ? `${span}${OUTLINE_SEPARATOR}${detail}` : span;
  };

  return (
    <OutlineChapterList
      rows={orderByStudy({ chapters, rows }).map((chapter) => (
        <OutlineChapterRow
          chapter={chapter}
          key={chapter.id}
          mark={markText(chapter)}
          number={numbers.get(chapter.id) ?? 0}
          params={params}
        />
      ))}
    />
  );
}

/** A chapter core can't place in an area yet isn't listed: "chapters in no exam area" is our data's gap, not the exam's. */
export async function AreaOutline({
  estimate,
  outline,
  params,
}: {
  estimate: DatedEstimate;
  outline: LibraryOutline;
  params: OutlineParams;
}) {
  const t = await getExtracted();
  const chapters = outline.levels.flatMap((band) => band.chapters);
  const numbers = new Map(chapters.map((chapter, index) => [chapter.id, index + 1]));
  const rows = new Map(estimate.chapters.map((row) => [row.chapterId, row]));
  const areaOf = new Map(estimate.chapters.map((row) => [row.chapterId, row.area]));
  const groups = Map.groupBy(chapters, (chapter) => areaOf.get(chapter.id) ?? null);

  const areas = estimate.areas.flatMap((area) => (area.area ? [area.area] : []));
  const order = [...new Set(areas)].filter((area) => groups.has(area));

  const shared = { numbers, params, rows };

  if (order.length <= 1) {
    return (
      <div className="flex flex-col gap-2">
        <AreaFit area={order[0] ?? null} chapters={chapters} estimate={estimate} rows={rows} />
        <AreaChapters chapters={chapters} {...shared} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {order.map((area) => {
        const areaChapters = groups.get(area) ?? [];

        return (
          <RouteZone
            aside={t("{count, plural, one {# chapter} other {# chapters}}", {
              count: areaChapters.length,
            })}
            key={area}
            summary={
              <span className="flex flex-col gap-2">
                <span>{area}</span>
                <AreaFit area={area} chapters={areaChapters} estimate={estimate} rows={rows} />
              </span>
            }
          >
            <AreaChapters chapters={areaChapters} {...shared} />
          </RouteZone>
        );
      })}
    </div>
  );
}
