"use client";

import { type SyllabusChapter } from "@zoonk/core/view-models/syllabus/contract";
import { cn } from "@zoonk/ui/lib/utils";
import { BookOpenIcon, ChevronRightIcon } from "lucide-react";
import { LearnLink } from "../learn-link";
import { FarTopicSheet } from "../topic-outline/far-topic-sheet";
import { useTopicOutlineActions } from "../topic-outline/topic-outline-actions";
import { useWritingLine } from "../topic-outline/use-far-topic-line";

const TOPIC_CHAPTER_CLASS =
  "text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 -mx-2 flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm transition-colors outline-none focus-visible:ring-[3px]";

/**
 * A chapter that teaches a topic, one line under it, opening the chapter's page. One whose lessons
 * aren't written yet says what the plan knows and opens a sheet that can write them now.
 */
function TopicChapterLink({
  chapter,
  chapterHref,
}: {
  chapter: SyllabusChapter;
  chapterHref: (chapterId: string) => string;
}) {
  const writingLine = useWritingLine();
  const outlineActions = useTopicOutlineActions();

  const content = (
    <>
      <BookOpenIcon aria-hidden="true" className="size-4 shrink-0" />
      <span className="line-clamp-2 min-w-0 flex-1 py-1">{chapter.title}</span>
    </>
  );

  if (!chapter.chapterId) {
    const words = writingLine({
      far: chapter.far,
      lessons: chapter.plannedLessons,
      nextDate: chapter.nextDate,
    });

    const line = words && <span className="shrink-0 text-xs">{words}</span>;

    if (chapter.writing && chapter.skillId && outlineActions) {
      return (
        <FarTopicSheet
          actions={outlineActions}
          chapterHref={chapterHref}
          lessons={chapter.plannedLessons}
          nextDate={chapter.nextDate}
          skillId={chapter.skillId}
          title={chapter.title}
          trigger={<button className={cn(TOPIC_CHAPTER_CLASS, "w-full text-left")} type="button" />}
        >
          {content}
          {line}
        </FarTopicSheet>
      );
    }

    return (
      <span className="text-muted-foreground flex min-h-11 items-center gap-2 text-sm">
        {content}
        {line}
      </span>
    );
  }

  return (
    <LearnLink className={TOPIC_CHAPTER_CLASS} href={chapterHref(chapter.chapterId)}>
      {content}
      <ChevronRightIcon aria-hidden="true" className="size-4 shrink-0" />
    </LearnLink>
  );
}

export function TopicChapters({
  chapterHref,
  chapters,
}: {
  chapterHref: (chapterId: string) => string;
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
