import { type PaceEstimate, isDatedEstimate } from "@/components/catalog/plan-estimate";
import { PublicDisclosure } from "@/components/public/public-disclosure";
import { getExtracted } from "next-intl/server";
import {
  OUTLINE_SEPARATOR,
  type OutlineBand,
  OutlineChapterRow,
  type OutlineParams,
  PaceMarks,
} from "./outline-chapter-row";
import { type ChapterWeeks, getChapterWeeksFormatter } from "./outline-weeks";

/** How many chapter names a level's summary mentions before it's opened. */
const CHAPTERS_NAMED = 3;

/** The plan a level's marks read: the window's radios and each pace's plan to the course's end. */
export type LevelPlan = { paceSwitch: string; paces: PaceEstimate[] };

/** Each pace's weeks for each chapter, from a plan to the course's end. */
function getChapterWeeks(paces: PaceEstimate[]): Map<number, Map<string, ChapterWeeks>> {
  return new Map(
    paces.map((pace) => [
      pace.minutes,
      new Map(
        isDatedEstimate(pace.estimate)
          ? []
          : pace.estimate.chapters.map((row) => [row.chapterId, row]),
      ),
    ]),
  );
}

/**
 * A level of the course (Overview, Beginner…) folded to one row: its name, its first chapters and
 * how many there are, with the weeks it takes at the picked pace; open, its chapters with their
 * lessons and their weeks, numbered across the whole course.
 */
export async function OutlineLevel({
  band,
  firstNumber,
  label,
  open,
  params,
  plan,
}: {
  band: OutlineBand;
  firstNumber: number;
  label: string;
  open: boolean;
  params: OutlineParams;
  plan: LevelPlan | null;
}) {
  const t = await getExtracted();
  const weeks = plan ? getChapterWeeks(plan.paces) : null;

  const weeksText = await getChapterWeeksFormatter();
  const weeksForChapter = (row: ChapterWeeks | undefined) => (row ? weeksText(row) : null);

  /**
   * The weeks the level takes at one pace, after its chapter count: "weeks 2–15", or one week,
   * from its first chapter's first week to its last chapter's last.
   */
  const spanText = (minutes: number) => {
    const rows = band.chapters
      .map((chapter) => weeks?.get(minutes)?.get(chapter.id))
      .filter((row): row is ChapterWeeks => typeof row?.week === "number");

    if (rows.length === 0) {
      return null;
    }

    const first = Math.min(...rows.map((row) => row.week ?? 0));
    const last = Math.max(...rows.map((row) => row.endWeek ?? row.week ?? 0));

    return first === last
      ? t("week {week, number}", { week: first })
      : t("weeks {first, number}–{last, number}", { first, last });
  };

  const chapterCount = t("{count, plural, one {# chapter} other {# chapters}}", {
    count: band.chapters.length,
  });

  return (
    <PublicDisclosure
      aside={
        plan ? (
          <>
            {chapterCount}
            <PaceMarks
              marks={plan.paces.map((pace) => {
                const span = spanText(pace.minutes);
                return { minutes: pace.minutes, text: span && `${OUTLINE_SEPARATOR}${span}` };
              })}
              paceSwitch={plan.paceSwitch}
            />
          </>
        ) : (
          chapterCount
        )
      }
      open={open}
      summary={
        <span className="flex flex-col gap-1">
          <span>{label}</span>
          <span className="text-muted-foreground text-[13px] leading-snug font-normal text-pretty sm:text-sm">
            {band.chapters
              .slice(0, CHAPTERS_NAMED)
              .map((chapter) => chapter.title)
              .join(OUTLINE_SEPARATOR)}
          </span>
        </span>
      }
    >
      <ol>
        {band.chapters.map((chapter, index) => (
          <OutlineChapterRow
            chapter={chapter}
            key={chapter.id}
            mark={
              plan && (
                <PaceMarks
                  marks={plan.paces.map((pace) => ({
                    minutes: pace.minutes,
                    text: weeksForChapter(weeks?.get(pace.minutes)?.get(chapter.id)),
                  }))}
                  paceSwitch={plan.paceSwitch}
                />
              )
            }
            number={firstNumber + index}
            params={params}
          />
        ))}
      </ol>
    </PublicDisclosure>
  );
}
