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
import { StatusMark } from "./status-mark";

type ListedLesson = Pick<ChapterLessonView, "lessonId" | "minutes" | "state" | "title" | "written">;

const LESSONS_TITLE_ID = "lesson-list-title";

/** The lesson's mark: done, the one to open now, or ahead. */
function LessonMark({ lesson }: { lesson: ListedLesson }) {
  const t = useExtracted();

  if (lesson.state === "done") {
    return <StatusMark label={t("Done")} status="done" />;
  }

  if (lesson.state === "next") {
    return <StatusMark label={t("Up next")} status="next" />;
  }

  return <StatusMark label={t("Coming up")} status="todo" />;
}

/**
 * A written lesson loads its screens before the tap (reading the plan's lessons counts toward no
 * limit), so it opens at once; one not written yet loads only the player's frame, and is written
 * when the learner opens it.
 */
function LessonRow({
  href,
  lesson,
  position,
}: {
  href: string;
  lesson: ListedLesson;
  position: number;
}) {
  const t = useExtracted();
  const isNext = lesson.state === "next";

  return (
    <ListRowLink
      className={cn(isNext && "bg-muted/50")}
      href={href}
      prefetch={lesson.written ? true : "auto"}
    >
      <ListRowLeading>
        <LessonMark lesson={lesson} />
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
      {lesson.minutes > 0 && (
        <ListRowTrailing>{t("{minutes, number} min", { minutes: lesson.minutes })}</ListRowTrailing>
      )}
    </ListRowLink>
  );
}

/**
 * A unit's or chapter's lessons under their header, in teaching order, numbered, each with its
 * mark and minutes; the next one is marked "Up next" and is also the page's "Continue". Every lesson opens in
 * the player, so a lesson a session schedules out of order is always one tap away.
 */
export function LessonList({
  lessonHref,
  lessons,
}: {
  lessonHref: (lessonId: string) => string;
  lessons: readonly ListedLesson[];
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
            <LessonRow href={lessonHref(lesson.lessonId)} lesson={lesson} position={index + 1} />
          </li>
        ))}
      </ol>
    </PageSection>
  );
}
