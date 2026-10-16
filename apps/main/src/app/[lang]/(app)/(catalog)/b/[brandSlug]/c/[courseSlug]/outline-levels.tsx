import { type UndatedEstimate } from "@/components/catalog/plan-estimate";
import { PublicDisclosure } from "@/components/public/public-disclosure";
import { getExtracted } from "next-intl/server";
import {
  OUTLINE_SEPARATOR,
  type OutlineBand,
  OutlineChapterRow,
  type OutlineParams,
} from "./outline-chapter-row";
import { type ChapterWeeks, getChapterWeeksFormatter } from "./outline-weeks";

/** How many chapter names a level's summary mentions before it's opened. */
const CHAPTERS_NAMED = 3;

/**
 * A level of the course (Overview, Beginner…) folded to one row: its name, its first chapters and
 * how many there are, with the weeks it takes in the selected example; open, its chapters with their
 * lessons and their weeks, numbered across the whole course.
 */
export async function OutlineLevel({
  band,
  estimate,
  firstNumber,
  label,
  open,
  params,
}: {
  band: OutlineBand;
  estimate: UndatedEstimate | null;
  firstNumber: number;
  label: string;
  open: boolean;
  params: OutlineParams;
}) {
  const t = await getExtracted();

  const weeks = new Map<string, ChapterWeeks>(
    estimate?.chapters.map((row) => [row.chapterId, row]),
  );

  const weeksText = await getChapterWeeksFormatter();
  const weeksForChapter = (row: ChapterWeeks | undefined) => (row ? weeksText(row) : null);

  /**
   * The weeks the level takes at one pace, after its chapter count: "weeks 2–15", or one week,
   * from its first chapter's first week to its last chapter's last.
   */
  const spanText = () => {
    const rows = band.chapters
      .map((chapter) => weeks.get(chapter.id))
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

  const span = spanText();

  return (
    <PublicDisclosure
      aside={[chapterCount, span].filter(Boolean).join(OUTLINE_SEPARATOR)}
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
            mark={weeksForChapter(weeks.get(chapter.id))}
            number={firstNumber + index}
            params={params}
          />
        ))}
      </ol>
    </PublicDisclosure>
  );
}
