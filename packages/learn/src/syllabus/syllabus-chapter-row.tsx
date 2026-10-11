"use client";

import { type SyllabusChapter } from "@zoonk/core/view-models/syllabus/contract";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { ChapterMark } from "../_components/chapter-mark";
import {
  ListRow,
  ListRowButton,
  ListRowContent,
  ListRowDescription,
  ListRowLeading,
  ListRowLink,
  ListRowTitle,
  ListRowTrailing,
} from "../_components/list-group";
import { useFormatIsoDate } from "../_utils/iso-date";
import { FarTopicSheet } from "../topic-outline/far-topic-sheet";
import { useTopicOutlineActions } from "../topic-outline/topic-outline-actions";
import { useWritingLine } from "../topic-outline/use-far-topic-line";

/** What sits at the end of a chapter's row: when the plan gets to it, or nothing once done or next. */
function ChapterMeta({ chapter }: { chapter: SyllabusChapter }) {
  const formatDate = useFormatIsoDate();

  if (chapter.state !== "upcoming" || !chapter.nextDate) {
    return null;
  }

  return formatDate(chapter.nextDate, "day");
}

/**
 * The line under a chapter's name: for a topic whose lessons aren't written yet, that they're on
 * the way or the lessons the plan expects for it (its date is at the row's end), "1 lesson · up
 * next" for the next one, or that it was skipped because the learner showed they know it.
 */
function ChapterLine({ chapter }: { chapter: SyllabusChapter }) {
  const t = useExtracted();
  const writingLine = useWritingLine();

  if (chapter.known) {
    return <ListRowDescription>{t("Skipped because you already know it")}</ListRowDescription>;
  }

  if (chapter.writing) {
    const line = writingLine({ far: chapter.far, lessons: chapter.plannedLessons });
    return line && <ListRowDescription>{line}</ListRowDescription>;
  }

  if (chapter.state !== "current") {
    return null;
  }

  const left = Math.max(0, chapter.lessonsTotal - chapter.lessonsDone);

  return (
    <ListRowDescription>
      {left > 0
        ? t("{count, plural, one {# lesson · up next} other {# lessons · up next}}", {
            count: left,
          })
        : t("Up next")}
    </ListRowDescription>
  );
}

/**
 * A chapter of a subject: its mark, its number in the subject and name and when the plan gets to
 * it, opening its page; the next one stands out with what's left in it. A topic whose lessons
 * aren't written yet has no page: it opens a sheet that can write them now.
 */
export function SyllabusChapterRow({
  chapter,
  chapterHref,
  href,
}: {
  chapter: SyllabusChapter;
  /** A chapter's page, for the chapters a topic's sheet lists once written. */
  chapterHref: (chapterId: string) => string;
  /** Its page; null while its lessons aren't written. */
  href: string | null;
}) {
  const isNext = chapter.state === "current";
  const outlineActions = useTopicOutlineActions();

  const content = (
    <>
      <ListRowLeading>
        <ChapterMark chapter={chapter} isNext={isNext} skipped={chapter.known} />
      </ListRowLeading>
      <ListRowContent className="min-h-13 py-2.5">
        <ListRowTitle
          className={cn(
            "line-clamp-2",
            chapter.state === "done" && "text-muted-foreground",
            isNext && "font-semibold",
          )}
        >
          <span className="text-muted-foreground font-normal tabular-nums">{`${chapter.position}. `}</span>
          {chapter.title}
        </ListRowTitle>
        <ChapterLine chapter={chapter} />
      </ListRowContent>
      <ListRowTrailing>
        <ChapterMeta chapter={chapter} />
      </ListRowTrailing>
    </>
  );

  const className = cn(isNext && "bg-muted/50");

  if (!href && chapter.writing && chapter.skillId && outlineActions) {
    return (
      <FarTopicSheet
        actions={outlineActions}
        chapterHref={chapterHref}
        lessons={chapter.plannedLessons}
        nextDate={chapter.nextDate}
        skillId={chapter.skillId}
        title={chapter.title}
        trigger={<ListRowButton className={className} />}
      >
        {content}
      </FarTopicSheet>
    );
  }

  if (!href) {
    return <ListRow className={className}>{content}</ListRow>;
  }

  return (
    <ListRowLink className={className} href={href}>
      {content}
    </ListRowLink>
  );
}
