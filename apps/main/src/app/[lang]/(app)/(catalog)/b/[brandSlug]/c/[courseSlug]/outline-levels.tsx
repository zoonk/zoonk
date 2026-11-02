import {
  CourseExampleNumbers,
  CourseHere,
  CourseLevelZone,
} from "@/components/catalog/course-progress";
import { type UndatedEstimate } from "@zoonk/core/catalog/course-plan-example-contract";
import { type CourseLevel } from "@zoonk/db/enums";
import { RouteZoneAhead } from "@zoonk/learn/route-line";
import { cn } from "@zoonk/ui/lib/utils";
import { getExtracted } from "next-intl/server";
import { type ReactNode } from "react";
import {
  OUTLINE_SEPARATOR,
  type OutlineBand,
  OutlineChapterList,
  OutlineChapterRow,
  type OutlineParams,
} from "./outline-chapter-row";
import { type ChapterWeeks, getChapterWeeksFormatter } from "./outline-weeks";

const CHAPTERS_NAMED = 3;

const LEVEL_LINE_CLASS =
  "text-muted-foreground text-[13px] leading-snug font-normal text-pretty sm:text-sm";

function LevelLabel({
  courseId,
  label,
  level,
  line,
}: {
  courseId: string;
  label: string;
  level: CourseLevel;
  line: ReactNode;
}) {
  return (
    <span className="flex flex-col gap-1">
      <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        {label}
        <CourseHere courseId={courseId} level={level} />
      </span>
      {line}
    </span>
  );
}

/** A level of the course with no chapter written yet, so a learner sees the whole course it promises. */
export async function UnwrittenLevel({
  courseId,
  label,
  level,
}: {
  courseId: string;
  label: string;
  level: CourseLevel;
}) {
  const t = await getExtracted();

  return (
    <RouteZoneAhead
      summary={
        <LevelLabel
          courseId={courseId}
          label={label}
          level={level}
          line={
            <span className={LEVEL_LINE_CLASS}>
              {t({
                description:
                  "Under the name of a course's level, such as Intermediate, that has no chapters yet. “it” is that level.",
                message: "Not written yet. Zoonk writes its chapters as learners reach it.",
              })}
            </span>
          }
        />
      }
    />
  );
}

export async function OutlineLevel({
  band,
  courseId,
  estimate,
  firstNumber,
  isFirst,
  label,
  params,
}: {
  band: OutlineBand;
  courseId: string;
  estimate: UndatedEstimate | null;
  firstNumber: number;
  isFirst: boolean;
  label: string;
  params: OutlineParams;
}) {
  const t = await getExtracted();

  const weeks = new Map<string, ChapterWeeks>(
    estimate?.chapters.map((row) => [row.chapterId, row]),
  );

  const weeksText = await getChapterWeeksFormatter();
  const weeksForChapter = (row: ChapterWeeks | undefined) => (row ? weeksText(row) : null);

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
    <CourseLevelZone
      aside={
        <>
          {chapterCount}
          {span && (
            <CourseExampleNumbers courseId={courseId}>
              {OUTLINE_SEPARATOR}
              {span}
            </CourseExampleNumbers>
          )}
        </>
      }
      courseId={courseId}
      isFirst={isFirst}
      level={band.level}
      summary={
        <LevelLabel
          courseId={courseId}
          label={label}
          level={band.level}
          line={
            <span className={cn(LEVEL_LINE_CLASS, "group-open/zone:hidden")}>
              {band.chapters
                .slice(0, CHAPTERS_NAMED)
                .map((chapter) => chapter.title)
                .join(OUTLINE_SEPARATOR)}
            </span>
          }
        />
      }
    >
      <OutlineChapterList
        courseId={courseId}
        rows={band.chapters.map((chapter, index) => ({
          chapterId: chapter.id,
          row: (
            <OutlineChapterRow
              chapter={chapter}
              courseId={courseId}
              key={chapter.id}
              mark={weeksForChapter(weeks.get(chapter.id))}
              number={firstNumber + index}
              params={params}
            />
          ),
        }))}
      />
    </CourseLevelZone>
  );
}
