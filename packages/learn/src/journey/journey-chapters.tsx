"use client";

import {
  type PlanChapterView,
  type PlanPhaseCheckpointView,
} from "@zoonk/core/plans/view-contract";
import { cn } from "@zoonk/ui/lib/utils";
import { ChevronRightIcon, MinusIcon, PlusIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { ChapterMark } from "../_components/chapter-mark";
import { LearnLink } from "../learn-link";
import { FarTopicSheet } from "../topic-outline/far-topic-sheet";
import { useTopicOutlineActions } from "../topic-outline/topic-outline-actions";
import { useWritingLine } from "../topic-outline/use-far-topic-line";
import { getChapterWindow } from "./chapter-window";
import { type JourneyPathLinks } from "./journey-links";
import { CheckpointRow, PATH_ROW_CLASS, PATH_ROW_LEADING_CLASS } from "./journey-phase-events";

export function getChapterKey(chapter: PlanChapterView): string {
  return chapter.chapterId ?? `${chapter.writing ? "writing" : "settled"}:${chapter.title}`;
}

/** Core leaves the title empty for lessons being written in the goal's own course. */
export function useChapterTitle() {
  const t = useExtracted();

  return (chapter: PlanChapterView): string => {
    if (chapter.skills.length > 0) {
      return t(
        "{count, plural, one {# skill you already know} other {# skills you already know}}",
        { count: chapter.skills.length },
      );
    }

    return chapter.title || t("More lessons");
  };
}

function isSkipped(chapter: PlanChapterView): boolean {
  return chapter.skills.length > 0 || chapter.testedOut;
}

export function isWritingAhead(chapter: PlanChapterView): boolean {
  return chapter.writing && !chapter.far && chapter.skills.length === 0;
}

function ChapterLessons({ chapter }: { chapter: PlanChapterView }) {
  const t = useExtracted();

  if (chapter.writing || chapter.lessonsTotal === 0 || isSkipped(chapter)) {
    return null;
  }

  return (
    <span className="text-muted-foreground shrink-0 font-mono text-xs tabular-nums">
      <span aria-hidden="true">
        {t("{done, number} / {total, number}", {
          done: chapter.lessonsDone,
          total: chapter.lessonsTotal,
        })}
      </span>
      <span className="sr-only">
        {t(
          "{total, plural, one {{done, number} of # lesson done} other {{done, number} of # lessons done}}",
          { done: chapter.lessonsDone, total: chapter.lessonsTotal },
        )}
      </span>
    </span>
  );
}

function ChapterRow({
  chapter,
  isNext,
  links,
}: {
  chapter: PlanChapterView;
  isNext: boolean;
  links: JourneyPathLinks;
}) {
  const t = useExtracted();
  const title = useChapterTitle();
  const writingLine = useWritingLine();
  const outlineActions = useTopicOutlineActions();

  const writing = chapter.writing
    ? writingLine({ far: chapter.far, lessons: chapter.plannedLessons, nextDate: chapter.nextDate })
    : null;

  const line =
    writing ??
    (chapter.testedOut && chapter.skills.length === 0
      ? t("Skipped because you already know it")
      : null) ??
    (chapter.deeper ? t("Going deeper into an earlier topic") : null);

  const content = (
    <>
      <span className={PATH_ROW_LEADING_CLASS}>
        <ChapterMark chapter={chapter} isNext={isNext} skipped={isSkipped(chapter)} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span
          className={cn(
            "line-clamp-2 font-medium",
            chapter.state === "done" && "text-muted-foreground",
          )}
        >
          {title(chapter)}
        </span>
        {line && <span className="text-muted-foreground text-xs">{line}</span>}
      </span>
      <ChapterLessons chapter={chapter} />
    </>
  );

  if (chapter.writing && chapter.skillId && outlineActions) {
    return (
      <FarTopicSheet
        actions={outlineActions}
        chapterHref={links.chapter}
        lessons={chapter.plannedLessons}
        nextDate={chapter.nextDate}
        skillId={chapter.skillId}
        title={title(chapter)}
        trigger={<button className={cn(PATH_ROW_CLASS, "hover:bg-muted/70")} type="button" />}
      >
        {content}
      </FarTopicSheet>
    );
  }

  if (!chapter.chapterId) {
    return <div className={PATH_ROW_CLASS}>{content}</div>;
  }

  return (
    <LearnLink
      className={cn(PATH_ROW_CLASS, "hover:bg-muted/70", isNext && "bg-muted hover:bg-muted")}
      href={links.chapter(chapter.chapterId)}
    >
      {content}
      <ChevronRightIcon aria-hidden="true" className="text-muted-foreground/60 size-4 shrink-0" />
    </LearnLink>
  );
}

export function WritingAheadLine({
  chapters,
  unit = false,
}: {
  chapters: readonly PlanChapterView[];
  unit?: boolean;
}) {
  const t = useExtracted();
  const writing = chapters.filter((chapter) => isWritingAhead(chapter));

  if (writing.length === 0) {
    return null;
  }

  const courses = writing.map((chapter) => chapter.title).filter(Boolean);

  return (
    <p className="text-muted-foreground py-2 text-xs" data-slot="writing-ahead">
      {courses.length > 0 &&
        t("Lessons from {courses} are being written.", { courses: courses.join(", ") })}
      {courses.length === 0 &&
        (unit
          ? t("More lessons for this unit are being written.")
          : t("More lessons for this phase are being written."))}
    </p>
  );
}

export function JourneyChapters({
  chapters,
  checkpoint,
  links,
}: {
  chapters: PlanChapterView[];
  checkpoint: PlanPhaseCheckpointView | null;
  links: JourneyPathLinks;
}) {
  const t = useExtracted();
  const [showAll, setShowAll] = useState(false);
  const rows = chapters.filter((chapter) => !isWritingAhead(chapter));
  const range = getChapterWindow({ states: rows.map((chapter) => chapter.state) });
  const hidden = rows.length - (range.end - range.start);
  const shown = showAll ? rows : rows.slice(range.start, range.end);

  return (
    <ul className="flex flex-col">
      {shown.map((chapter) => (
        <li key={getChapterKey(chapter)}>
          <ChapterRow chapter={chapter} isNext={chapter.state === "current"} links={links} />
        </li>
      ))}

      {hidden > 0 && (
        <li>
          <button
            aria-expanded={showAll}
            className={cn(
              PATH_ROW_CLASS,
              "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
            )}
            onClick={() => setShowAll(!showAll)}
            type="button"
          >
            <span aria-hidden="true" className={PATH_ROW_LEADING_CLASS}>
              {showAll ? <MinusIcon className="size-3.5" /> : <PlusIcon className="size-3.5" />}
            </span>
            {showAll
              ? t("Show fewer chapters")
              : t("{count, plural, one {# more chapter} other {# more chapters}}", {
                  count: hidden,
                })}
          </button>
        </li>
      )}

      {checkpoint && (
        <li>
          <CheckpointRow checkpoint={checkpoint} links={links} />
        </li>
      )}

      <li className="empty:hidden">
        <WritingAheadLine chapters={chapters} />
      </li>
    </ul>
  );
}
