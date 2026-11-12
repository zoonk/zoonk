import { CourseHere, CourseLevelZone } from "@/components/catalog/course-progress";
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

/** A level of the course with no chapters yet, so a visitor sees the whole course it promises. */
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
                  "Under the name of a course's level, such as Intermediate, whose chapters aren't listed yet: they are ready by the time a learner reaches that level.",
                message: "Ready when you get there.",
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
  firstNumber,
  isFirst,
  label,
  params,
}: {
  band: OutlineBand;
  courseId: string;
  firstNumber: number;
  isFirst: boolean;
  label: string;
  params: OutlineParams;
}) {
  const t = await getExtracted();

  return (
    <CourseLevelZone
      aside={t("{count, plural, one {# chapter} other {# chapters}}", {
        count: band.chapters.length,
      })}
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
              number={firstNumber + index}
              params={params}
            />
          ),
        }))}
      />
    </CourseLevelZone>
  );
}
