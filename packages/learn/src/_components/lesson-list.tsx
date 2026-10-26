"use client";

import { type ChapterLessonView } from "@zoonk/core/view-models/chapter/contract";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useFormatDuration } from "../_utils/time-format";
import {
  CURRENT_ROW_CLASS,
  LIST_GROUP_CLASS,
  ListRowContent,
  ListRowLeading,
  ListRowLink,
  ListRowTitle,
  ListRowTrailing,
} from "./list-group";
import { MeterPart, MeterParts } from "./meter";
import { PageSection, PageSectionDetail, PageSectionHeader, PageSectionTitle } from "./page";
import { PlusMark } from "./plus-lock";
import { StatusMark } from "./status-mark";

type ListedLesson = Pick<
  ChapterLessonView,
  "lessonId" | "minutes" | "state" | "title" | "written"
> &
  Partial<Pick<ChapterLessonView, "plusRequired">>;

const LESSONS_TITLE_ID = "lesson-list-title";

/** The lesson's mark: done, the one to open now, or ahead. */
function LessonMark({ isNext, lesson }: { isNext: boolean; lesson: ListedLesson }) {
  const t = useExtracted();

  if (lesson.state === "done") {
    return <StatusMark label={t("Done")} status="done" />;
  }

  if (isNext) {
    return <StatusMark label={t("Up next")} status="next" />;
  }

  return <StatusMark label={t("Coming up")} status="todo" />;
}

/**
 * A written lesson loads its screens before the tap (reading the plan's lessons counts toward no
 * limit), so it opens at once; one not written yet loads only the player's frame, and is written
 * when the learner opens it. One the learner's plan leaves to Plus is marked so, and opens to say
 * what Plus unlocks.
 */
function LessonRow({
  href,
  isNext,
  lesson,
  position,
}: {
  href: string;
  isNext: boolean;
  lesson: ListedLesson;
  position: number;
}) {
  const formatDuration = useFormatDuration();

  return (
    <ListRowLink
      className={cn(isNext && CURRENT_ROW_CLASS)}
      href={href}
      lessonWritten={lesson.written}
      prefetch={lesson.written ? true : "auto"}
    >
      <ListRowLeading>
        <LessonMark isNext={isNext} lesson={lesson} />
      </ListRowLeading>
      <ListRowContent>
        <ListRowTitle className={cn(lesson.state === "done" && "text-muted-foreground")}>
          <span className="text-muted-foreground font-mono text-xs font-normal tabular-nums">{`${position}. `}</span>
          {lesson.title}
        </ListRowTitle>
      </ListRowContent>
      {(lesson.plusRequired || lesson.minutes > 0) && (
        <ListRowTrailing>
          {lesson.plusRequired && <PlusMark className="font-sans" />}
          {lesson.minutes > 0 && formatDuration(lesson.minutes)}
        </ListRowTrailing>
      )}
    </ListRowLink>
  );
}

/**
 * A unit's or chapter's lessons under their header, flat, in teaching order, numbered, each with
 * its mark and minutes; the next one is the page's "Start" or "Continue", highlighted as "Up next"
 * when the host enables the mark (`upNext`). Every lesson opens in the player, so a lesson a
 * session schedules out of order is always one tap away.
 */
export function LessonList({
  lessonHref,
  lessons,
  upNext = false,
}: {
  lessonHref: (lessonId: string) => string;
  lessons: readonly ListedLesson[];
  /** Mark the lesson chosen as next by the host view. */
  upNext?: boolean;
}) {
  const t = useExtracted();
  const done = lessons.filter((lesson) => lesson.state === "done").length;

  return (
    <PageSection aria-labelledby={LESSONS_TITLE_ID}>
      <PageSectionHeader>
        <PageSectionTitle id={LESSONS_TITLE_ID}>{t("Lessons")}</PageSectionTitle>
        <PageSectionDetail>
          {t("{done, number} of {total, number}", { done, total: lessons.length })}
        </PageSectionDetail>
      </PageSectionHeader>

      <ol className={LIST_GROUP_CLASS}>
        {lessons.map((lesson, index) => (
          <li
            aria-current={upNext && lesson.state === "next" ? "step" : undefined}
            data-state={lesson.state}
            key={lesson.lessonId}
          >
            <LessonRow
              href={lessonHref(lesson.lessonId)}
              isNext={upNext && lesson.state === "next"}
              lesson={lesson}
              position={index + 1}
            />
          </li>
        ))}
      </ol>
    </PageSection>
  );
}

/**
 * A chapter's or unit's lessons as a meter of parts, one per lesson, blue once done, so the aside
 * shows at a glance how far the learner is ("1 of 3").
 */
export function LessonProgress({
  lessons,
}: {
  lessons: readonly Pick<ListedLesson, "lessonId" | "state">[];
}) {
  return (
    <MeterParts as="span" data-slot="lesson-progress">
      {lessons.map((lesson) => (
        <MeterPart
          as="span"
          className={cn(lesson.state === "done" && "bg-success")}
          key={lesson.lessonId}
        />
      ))}
    </MeterParts>
  );
}
