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
  ListRowNumberedTitle,
  ListRowTrailing,
} from "../_components/list-group";
import { useFormatPlanDate } from "../plan/plan-date-text";
import { FarTopicSheet } from "../topic-outline/far-topic-sheet";
import { useTopicOutlineActions } from "../topic-outline/topic-outline-actions";
import { useWritingLine } from "../topic-outline/use-far-topic-line";

function ChapterMeta({ chapter }: { chapter: SyllabusChapter }) {
  const formatPlanDate = useFormatPlanDate();

  if (chapter.state === "done" || !chapter.nextDate) {
    return null;
  }

  return formatPlanDate(chapter.nextDate);
}

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

export function SyllabusChapterRow({
  chapter,
  chapterHref,
  href,
}: {
  chapter: SyllabusChapter;
  chapterHref: (chapterId: string) => string;
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
        <ListRowNumberedTitle
          number={chapter.position}
          textClassName={cn(
            "line-clamp-2",
            (chapter.state === "done" || (!href && !chapter.skillId)) && "text-muted-foreground",
          )}
        >
          {chapter.title}
        </ListRowNumberedTitle>
        <ChapterLine chapter={chapter} />
      </ListRowContent>
      <ListRowTrailing>
        <ChapterMeta chapter={chapter} />
      </ListRowTrailing>
    </>
  );

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
