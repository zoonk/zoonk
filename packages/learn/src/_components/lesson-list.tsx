"use client";

import { type ChapterLessonView } from "@zoonk/core/view-models/chapter/contract";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import {
  LIST_GROUP_CLASS,
  ListRowContent,
  ListRowDescription,
  ListRowLeading,
  ListRowLink,
  ListRowTitle,
  ListRowTrailing,
} from "./list-group";
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
  const t = useExtracted();

  return (
    <ListRowLink
      className={cn(isNext && "bg-muted/50")}
      href={href}
      prefetch={lesson.written ? true : "auto"}
    >
      <ListRowLeading>
        <LessonMark isNext={isNext} lesson={lesson} />
      </ListRowLeading>
      <ListRowContent className="min-h-13 py-2.5">
        <ListRowTitle
          className={cn(
            lesson.state === "done" && "text-muted-foreground",
            isNext && "font-semibold",
          )}
        >
          <span className="text-muted-foreground font-normal tabular-nums">{`${position}. `}</span>
          {lesson.title}
        </ListRowTitle>
        {isNext && <ListRowDescription aria-hidden="true">{t("Up next")}</ListRowDescription>}
      </ListRowContent>
      {(lesson.plusRequired || lesson.minutes > 0) && (
        <ListRowTrailing>
          {lesson.plusRequired && <PlusMark />}
          {lesson.minutes > 0 && t("{minutes, number} min", { minutes: lesson.minutes })}
        </ListRowTrailing>
      )}
    </ListRowLink>
  );
}

/**
 * A unit's or chapter's lessons under their header, in teaching order, numbered, each with its
 * mark and minutes; the next one is the page's "Continue", and is marked "Up next" only when it's
 * the one Today opens next (`upNext`), so two pages never both say "Up next" for different
 * lessons. Every lesson opens in the player, so a lesson a session schedules out of order is
 * always one tap away.
 */
export function LessonList({
  lessonHref,
  lessons,
  upNext = true,
}: {
  lessonHref: (lessonId: string) => string;
  lessons: readonly ListedLesson[];
  /** The page holds the lesson Today opens next, which it marks "Up next". */
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
          <li data-state={lesson.state} key={lesson.lessonId}>
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
