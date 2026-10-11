"use client";

import {
  type PlanChapterView,
  type PlanPhaseCheckpointView,
} from "@zoonk/core/plans/view-contract";
import { cn } from "@zoonk/ui/lib/utils";
import { MinusIcon, PlusIcon } from "lucide-react";
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
function getChapterKey(chapter: PlanChapterView): string {
  return chapter.chapterId ?? `${chapter.writing ? "writing" : "settled"}:${chapter.title}`;
}

/**
 * A chapter's name: a settled row of skills says how many the learner already knows, not its
 * course, and never runs on as a list of their names. Lessons still being written go by their
 * course, and are just "More lessons" when that's the goal's own course (core leaves the title
 * empty then).
 */
function useChapterTitle() {
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
 * One chapter of the path: done, the next one (its tile and "Next", the page's obvious target) or
 * ahead. Its page opens on tap. Lessons still being written have no page yet, so their row only
 * says so; topics after the weeks the plan writes ahead say what the plan knows ("About 12 lessons
 * · from March") and, unless chapters already teach them, open a sheet that can write their
 * lessons now. A chapter an earlier phase started says it goes deeper, so a later phase never reads
 * as listing it twice.
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
            "line-clamp-2",
            chapter.state === "done" && "text-muted-foreground",
            isNext && "font-semibold",
          )}
        >
          {title(chapter)}
        </span>
        {line && <span className="text-muted-foreground text-xs">{line}</span>}
      </span>
      {isNext && (
        <span className="bg-primary text-primary-foreground shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium">
          {t("Up next")}
        </span>
      )}
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
        trigger={
          <button className={cn(PATH_ROW_CLASS, "hover:bg-muted w-full text-left")} type="button" />
        }
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
      className={cn(PATH_ROW_CLASS, "hover:bg-muted", isNext && "bg-muted/60")}
      href={links.chapter(chapter.chapterId)}
    >
      {content}
    </LearnLink>
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
  const range = getChapterWindow({ states: chapters.map((chapter) => chapter.state) });
  const hidden = chapters.length - (range.end - range.start);
  const shown = showAll ? chapters : chapters.slice(range.start, range.end);

  return (
    <ul className="flex flex-col gap-0.5">
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
              "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
            onClick={() => setShowAll(!showAll)}
            type="button"
          >
            <span aria-hidden="true" className={PATH_ROW_LEADING_CLASS}>
              {showAll ? <MinusIcon className="size-4" /> : <PlusIcon className="size-4" />}
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
    </ul>
  );
}
