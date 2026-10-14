import { findEstimateArea, getAreaStudyText } from "@/components/catalog/area-study";
import { type DatedEstimate } from "@/components/catalog/plan-estimate";
import { PublicDisclosure } from "@/components/public/public-disclosure";
import { Variant } from "@/components/public/variant-switch";
import { type LibraryOutline } from "@/data/catalog/resolve-catalog-route";
import { getExtracted } from "next-intl/server";
import {
  OUTLINE_SEPARATOR,
  type OutlineChapter,
  OutlineChapterRow,
  type OutlineParams,
  PaceMarks,
} from "./outline-chapter-row";
import { getChapterWeeksFormatter, getChapterWorkFormatter } from "./outline-weeks";

/** One pace's plan for an exam course, read against the exam's date. */
export type DatedPace = { estimate: DatedEstimate; minutes: number };

type ChapterRow = DatedEstimate["chapters"][number];

/** The plan at an area's chapters, per pace: each chapter's row by its id. */
type AreaRows = Map<number, Map<string, ChapterRow>>;

function getAreaRows({ chapters, paces }: { chapters: OutlineChapter[]; paces: DatedPace[] }) {
  const ids = new Set(chapters.map((chapter) => chapter.id));

  return new Map(
    paces.map((pace) => [
      pace.minutes,
      new Map(
        pace.estimate.chapters
          .filter((row) => ids.has(row.chapterId))
          .map((row) => [row.chapterId, row]),
      ),
    ]),
  );
}

/**
 * The area's chapters in the order the plan studies them at the pace the window picks first: what
 * fits, by the planner's study order, then what's left out, in the course's order (core numbers
 * those after the rest). Other paces keep this order and say where each chapter falls.
 */
function orderByStudy({
  chapters,
  rows,
}: {
  chapters: OutlineChapter[];
  rows?: Map<string, ChapterRow>;
}) {
  const order = (chapter: OutlineChapter) =>
    rows?.get(chapter.id)?.studyOrder ?? Number.POSITIVE_INFINITY;

  return chapters.toSorted((first, second) => order(first) - order(second));
}

/**
 * How an area fares at each pace, the picked one showing: its study time, then how many of its
 * lessons fit, its quick lessons and, when some fit and some don't, its chapters left out (a
 * whole area left out says so in its time). No bar: a share of time would read as coverage.
 */
async function AreaFit({
  area,
  chapters,
  paceSwitch,
  paces,
  rows,
}: {
  area: string | null;
  chapters: OutlineChapter[];
  paceSwitch: string;
  paces: DatedPace[];
  rows: AreaRows;
}) {
  const t = await getExtracted();
  const areaText = await getAreaStudyText();

  return paces.map((pace) => {
    const entry = findEstimateArea(pace.estimate, area);
    const text = entry ? areaText(entry) : null;

    const leftOut = chapters.filter(
      (chapter) => (rows.get(pace.minutes)?.get(chapter.id)?.week ?? null) === null,
    ).length;

    return (
      <Variant
        as="span"
        className="flex flex-col gap-1.5"
        key={pace.minutes}
        name={paceSwitch}
        value={String(pace.minutes)}
      >
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
      </Variant>
    );
  });
}

/**
 * An area's chapters as rows, each with its week in the plan at the picked pace, how much of it
 * fits, or that it's left out.
 */
async function AreaChapters({
  chapters,
  defaultMinutes,
  numbers,
  paceSwitch,
  paces,
  params,
  rows,
}: {
  chapters: OutlineChapter[];
  defaultMinutes: number;
  numbers: Map<string, number>;
  paceSwitch: string;
  paces: DatedPace[];
  params: OutlineParams;
  rows: AreaRows;
}) {
  const t = await getExtracted();

  const weeksText = await getChapterWeeksFormatter();
  const workText = await getChapterWorkFormatter();

  /**
   * A chapter's mark at one pace: its weeks, with how many of its own lessons fit when not all do,
   * or what it's studied through when none does; "Left out" only when the plan holds no work of it.
   */
  const markText = ({ chapter, minutes }: { chapter: OutlineChapter; minutes: number }) => {
    const row = rows.get(minutes)?.get(chapter.id);
    const span = row ? weeksText(row) : null;

    if (!row || !span) {
      return t("Left out");
    }

    const detail =
      row.lessonsInPlan === 0
        ? workText(row)
        : row.lessonsInPlan < chapter.lessons.length &&
          t("{count, number} of {total, number} lessons", {
            count: row.lessonsInPlan,
            total: chapter.lessons.length,
          });

    return detail ? `${span}${OUTLINE_SEPARATOR}${detail}` : span;
  };

  return (
    <ol>
      {orderByStudy({ chapters, rows: rows.get(defaultMinutes) }).map((chapter) => (
        <OutlineChapterRow
          chapter={chapter}
          key={chapter.id}
          mark={
            <PaceMarks
              marks={paces.map((pace) => ({
                minutes: pace.minutes,
                text: markText({ chapter, minutes: pace.minutes }),
              }))}
              paceSwitch={paceSwitch}
            />
          }
          number={numbers.get(chapter.id) ?? 0}
          params={params}
        />
      ))}
    </ol>
  );
}

/**
 * The outline by the exam's areas, for an exam course read against its date: each area folded to
 * its name and how much of it fits, its chapters in the plan's order when opened (they're long,
 * and the summaries already say what a visitor came to compare). Areas follow core's estimate; a
 * chapter it can't place in an area yet (never a guessed one) isn't listed here, since a group of
 * "chapters in no exam area" is our data's gap, not the exam's structure. An exam with one area
 * lists its chapters right away.
 */
export async function AreaOutline({
  defaultMinutes,
  outline,
  paceSwitch,
  paces,
  params,
}: {
  defaultMinutes: number;
  outline: LibraryOutline;
  paceSwitch: string;
  paces: DatedPace[];
  params: OutlineParams;
}) {
  const t = await getExtracted();
  const chapters = outline.levels.flatMap((band) => band.chapters);
  const numbers = new Map(chapters.map((chapter, index) => [chapter.id, index + 1]));
  const [first] = paces;
  const areaOf = new Map(first?.estimate.chapters.map((row) => [row.chapterId, row.area]));
  const groups = Map.groupBy(chapters, (chapter) => areaOf.get(chapter.id) ?? null);

  const areas = first?.estimate.areas.flatMap((area) => (area.area ? [area.area] : []));
  const order = [...new Set(areas)].filter((area) => groups.has(area));

  const shared = { defaultMinutes, numbers, paceSwitch, paces, params };

  // One area (or none placed yet) lists every chapter at once.
  if (order.length <= 1) {
    const rows = getAreaRows({ chapters, paces });

    return (
      <div className="flex flex-col gap-2">
        <AreaFit
          area={order[0] ?? null}
          chapters={chapters}
          paceSwitch={paceSwitch}
          paces={paces}
          rows={rows}
        />
        <AreaChapters chapters={chapters} rows={rows} {...shared} />
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {order.map((area) => {
        const areaChapters = groups.get(area) ?? [];
        const rows = getAreaRows({ chapters: areaChapters, paces });

        return (
          <PublicDisclosure
            aside={t("{count, plural, one {# chapter} other {# chapters}}", {
              count: areaChapters.length,
            })}
            key={area}
            summary={
              <span className="flex flex-col gap-2">
                <span>{area}</span>
                <AreaFit
                  area={area}
                  chapters={areaChapters}
                  paceSwitch={paceSwitch}
                  paces={paces}
                  rows={rows}
                />
              </span>
            }
          >
            <AreaChapters chapters={areaChapters} rows={rows} {...shared} />
          </PublicDisclosure>
        );
      })}
    </div>
  );
}
