"use client";

import { type SyllabusChapter } from "@zoonk/core/view-models/syllabus/contract";
import { RowChevron } from "@zoonk/ui/components/row-chevron";
import { cn } from "@zoonk/ui/lib/utils";
import { BookOpenIcon } from "lucide-react";
import { ListRowChevronSpace } from "../_components/list-group";
import { LearnLink } from "../learn-link";
import { FarTopicSheet } from "../topic-outline/far-topic-sheet";
import { useTopicOutlineActions } from "../topic-outline/topic-outline-actions";
import { useWritingLine } from "../topic-outline/use-far-topic-line";

/** A chapter under its topic ends like the topic's own row: its words, then the chevron's slot. */
const TOPIC_CHAPTER_ROW_CLASS = "text-muted-foreground flex min-h-11 items-center gap-3 text-sm";

const TOPIC_CHAPTER_CLASS = cn(
  TOPIC_CHAPTER_ROW_CLASS,
  "hover:text-foreground held-pressed:bg-muted held-pressed:text-foreground focus-visible:ring-ring/50 row-bleed rounded-lg transition-colors outline-none focus-visible:ring-[3px]",
);

function TopicChapterLink({
  chapter,
  chapterHref,
}: {
  chapter: SyllabusChapter;
  chapterHref: ((chapterId: string) => string) | null;
}) {
  const writingLine = useWritingLine();
  const outlineActions = useTopicOutlineActions();

  const content = (
    <>
      <BookOpenIcon aria-hidden="true" className="size-4 shrink-0" />
      <span className="line-clamp-2 min-w-0 flex-1 py-1">{chapter.title}</span>
    </>
  );

  if (!chapterHref || !chapter.chapterId) {
    const words = chapter.chapterId
      ? null
      : writingLine({
          far: chapter.far,
          lessons: chapter.plannedLessons,
          nextDate: chapter.nextDate,
        });

    const line = words && <span className="shrink-0 text-xs">{words}</span>;

    if (chapterHref && chapter.writing && chapter.skillId && outlineActions) {
      return (
        <FarTopicSheet
          actions={outlineActions}
          chapterHref={chapterHref}
          lessons={chapter.plannedLessons}
          nextDate={chapter.nextDate}
          skillId={chapter.skillId}
          title={chapter.title}
          trigger={<button className={cn(TOPIC_CHAPTER_CLASS, "text-left")} type="submit" />}
        >
          {content}
          {line}
          <ListRowChevronSpace />
        </FarTopicSheet>
      );
    }

    return (
      <span className={TOPIC_CHAPTER_ROW_CLASS}>
        {content}
        {line}
        <ListRowChevronSpace />
      </span>
    );
  }

  return (
    <LearnLink className={TOPIC_CHAPTER_CLASS} href={chapterHref(chapter.chapterId)}>
      {content}
      <RowChevron />
    </LearnLink>
  );
}

/** Without `chapterHref` the chapters only say what's there: none opens. */
export function TopicChapters({
  chapterHref,
  chapters,
}: {
  chapterHref: ((chapterId: string) => string) | null;
  chapters: readonly SyllabusChapter[];
}) {
  return (
    <ul className="flex flex-col">
      {chapters.map((chapter) => (
        <li key={chapter.chapterId ?? chapter.title}>
          <TopicChapterLink chapter={chapter} chapterHref={chapterHref} />
        </li>
      ))}
    </ul>
  );
}
