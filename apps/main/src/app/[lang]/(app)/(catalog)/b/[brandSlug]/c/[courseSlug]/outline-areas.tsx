import { type LibraryOutline } from "@/data/catalog/resolve-catalog-route";
import { type DatedEstimate } from "@zoonk/core/catalog/course-plan-example-contract";
import { RouteZone } from "@zoonk/learn/route-line";
import { getExtracted } from "next-intl/server";
import {
  type OutlineChapter,
  OutlineChapterList,
  OutlineChapterRow,
  type OutlineParams,
  ZoneChapterNames,
} from "./outline-chapter-row";

function AreaChapters({
  chapters,
  courseId,
  numbers,
  params,
}: {
  chapters: OutlineChapter[];
  courseId: string;
  numbers: Map<string, number>;
  params: OutlineParams;
}) {
  return (
    <OutlineChapterList
      courseId={courseId}
      rows={chapters.map((chapter) => ({
        chapterId: chapter.id,
        row: (
          <OutlineChapterRow
            chapter={chapter}
            courseId={courseId}
            key={chapter.id}
            number={numbers.get(chapter.id) ?? 0}
            params={params}
          />
        ),
      }))}
    />
  );
}

/**
 * The exam's own subjects, in the course's order. A chapter core can't place in a subject yet isn't
 * listed: "chapters in no exam subject" is our data's gap, not the exam's.
 */
export async function AreaOutline({
  courseId,
  estimate,
  outline,
  params,
}: {
  courseId: string;
  estimate: DatedEstimate;
  outline: LibraryOutline;
  params: OutlineParams;
}) {
  const t = await getExtracted();
  const chapters = outline.levels.flatMap((band) => band.chapters);
  const numbers = new Map(chapters.map((chapter, index) => [chapter.id, index + 1]));
  const areaOf = new Map(estimate.chapters.map((row) => [row.chapterId, row.area]));
  const groups = Map.groupBy(chapters, (chapter) => areaOf.get(chapter.id) ?? null);

  const areas = estimate.areas.flatMap((area) => (area.area ? [area.area] : []));
  const order = [...new Set(areas)].filter((area) => groups.has(area));

  const shared = { courseId, numbers, params };

  if (order.length <= 1) {
    return <AreaChapters chapters={chapters} {...shared} />;
  }

  return (
    <div className="flex flex-col gap-2">
      {order.map((area, index) => {
        const areaChapters = groups.get(area) ?? [];

        return (
          <RouteZone
            aside={t("{count, plural, one {# chapter} other {# chapters}}", {
              count: areaChapters.length,
            })}
            key={area}
            open={index === 0}
            summary={
              <span className="flex flex-col gap-1">
                {area}
                <ZoneChapterNames chapters={areaChapters} />
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
