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

/** Rows without a chapter (lessons being written, or settled) differ by their kind and name. */
export function getChapterKey(chapter: PlanChapterView): string {
  return chapter.chapterId ?? `${chapter.writing ? "writing" : "settled"}:${chapter.title}`;
}

/**
 * A chapter's name: a settled row of skills says how many the learner already knows, not its
 * course, and never runs on as a list of their names. Lessons still being written go by their
 * course, and are just "More lessons" when that's the goal's own course (core leaves the title
 * empty then).
 */
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

/** Done without studying it: placement settled its skills, or a test took all its lessons off. */
function isSkipped(chapter: PlanChapterView): boolean {
  return chapter.skills.length > 0 || chapter.testedOut;
}

/**
 * Lessons still being written ahead of the learner, without a page yet: said in one quiet line
 * under the phase's rows instead of a row of their own.
 */
export function isWritingAhead(chapter: PlanChapterView): boolean {
  return chapter.writing && !chapter.far && chapter.skills.length === 0;
}

/**
 * "3 / 8" at a chapter's end: its lessons done of its lessons, heard as words. Nothing for one
 * without lessons yet.
 */
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

/**
 * One chapter of the path: done, the next one (highlighted with its dot: the page's obvious
 * target, `aria-current`) or ahead, with its lessons done at its end. Its page opens on tap. Topics
 * after the weeks the plan writes ahead say what the plan knows ("About 12 lessons · from March")
 * and, unless chapters already teach them, open a sheet that can write their lessons now. A
 * chapter an earlier phase started says it goes deeper, so a later phase never reads as listing
 * it twice.
 */
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

/**
 * Lessons of the phase still being written, as one quiet line under its rows: the goal's own
 * course's ("More lessons for this phase are being written.", or "this unit" under a phase that is
 * one language unit, `unit`) or another course's, by its name.
 */
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

/**
 * An open phase: its chapters with the next one in sight (the rest one tap away, "14 more
 * chapters", which shows them in place) and the checkpoint that closes it.
 */
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
        <li
          aria-current={chapter.state === "current" ? "step" : undefined}
          key={getChapterKey(chapter)}
        >
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
