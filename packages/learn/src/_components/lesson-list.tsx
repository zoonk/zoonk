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
  ListRowNumberedTitle,
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
        <ListRowNumberedTitle
          number={position}
          textClassName={cn(lesson.state === "done" && "text-muted-foreground")}
        >
          {lesson.title}
        </ListRowNumberedTitle>
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

export function LessonList({
  lessonHref,
  lessons,
  upNext = false,
}: {
  lessonHref: (lessonId: string) => string;
  lessons: readonly ListedLesson[];
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
