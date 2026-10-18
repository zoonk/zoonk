"use client";

import { type SyllabusChapter } from "@zoonk/core/view-models/syllabus/contract";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { ChapterMark } from "../_components/chapter-mark";
import {
  CURRENT_ROW_CLASS,
  ListRow,
  ListRowButton,
  ListRowContent,
  ListRowDescription,
  ListRowLeading,
  ListRowLink,
  ListRowTitle,
  ListRowTrailing,
} from "../_components/list-group";
import { useFormatPlanDate } from "../plan/plan-date-text";
import { FarTopicSheet } from "../topic-outline/far-topic-sheet";
import { useTopicOutlineActions } from "../topic-outline/topic-outline-actions";
import { useWritingLine } from "../topic-outline/use-far-topic-line";

/** What sits at the end of a chapter's row: when the plan gets to it, or nothing once done. */
function ChapterMeta({ chapter }: { chapter: SyllabusChapter }) {
  const formatPlanDate = useFormatPlanDate();

  if (chapter.state === "done" || !chapter.nextDate) {
    return null;
  }

  return formatPlanDate(chapter.nextDate);
}

/**
 * The line under a chapter's name: for a topic whose lessons aren't written yet, that they're on
 * the way or the lessons the plan expects for it (its date is at the row's end), "4 lessons · 1
 * done" for the next one (its highlight says it's next), or that it was skipped because the
 * learner showed they know it.
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

  return (
    <ListRowDescription>
      {t(
        "{total, plural, one {# lesson} other {# lessons}} · {done, plural, =0 {# done} one {# done} other {# done}}",
        { done: chapter.lessonsDone, total: chapter.lessonsTotal },
      )}
    </ListRowDescription>
  );
}

/**
 * A chapter of a subject: its mark, its number in the subject and name and when the plan gets to
 * it, opening its page (a chevron says so); the next one is highlighted with its lessons. A topic
 * whose lessons aren't written yet has no page: it opens a sheet that can write them now, or, on
 * the way and not yet openable, is a quiet row without a chevron.
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
      <ListRowContent>
        <ListRowTitle
          className={cn(
            "line-clamp-2",
            (chapter.state === "done" || (!href && !chapter.skillId)) && "text-muted-foreground",
          )}
        >
          <span className="text-muted-foreground font-mono text-xs font-normal tabular-nums">{`${chapter.position}. `}</span>
          {chapter.title}
        </ListRowTitle>
        <ChapterLine chapter={chapter} />
      </ListRowContent>
      <ListRowTrailing>
        <ChapterMeta chapter={chapter} />
      </ListRowTrailing>
    </>
  );

  // The next one is the highlighted row, as Today's next block is.
  const className = cn(isNext && CURRENT_ROW_CLASS);

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
