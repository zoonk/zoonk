"use client";

import {
  type PlanChapterView,
  type PlanPhaseCheckpointView,
} from "@zoonk/core/plans/view-contract";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  FoldChevron,
} from "@zoonk/ui/components/collapsible";
import { RowChevron } from "@zoonk/ui/components/row-chevron";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useId, useState } from "react";
import { ChapterMark } from "../_components/chapter-mark";
import { LearnLink } from "../learn-link";
import { usePlanScreen } from "../plan/plan-context";
import { useLeftOutTopicsLabel } from "../syllabus/left-out-topics";
import { TopicMark } from "../syllabus/topic-mark";
import { FoldRow } from "../today/today-fold-row";
import { FarTopicSheet } from "../topic-outline/far-topic-sheet";
import { useTopicOutlineActions } from "../topic-outline/topic-outline-actions";
import { useWritingLine } from "../topic-outline/use-far-topic-line";
import { getChapterWindow } from "./chapter-window";
import { type JourneyPathLinks } from "./journey-links";
import {
  CheckpointRow,
  PATH_ROW_CLASS,
  PATH_ROW_LEADING_CLASS,
  PathRowBody,
} from "./journey-phase-events";

function getChapterKey(chapter: PlanChapterView): string {
  return chapter.chapterId ?? `${chapter.writing ? "writing" : "settled"}:${chapter.title}`;
}

/** Core leaves the title empty for lessons being written in the goal's own course. */
function useChapterTitle() {
  const t = useExtracted();

  return (chapter: PlanChapterView): string => {
    if (chapter.skills.length > 0) {
      return t(
        "{count, plural, one {# chapter you already know} other {# chapters you already know}}",
        { count: chapter.skills.length },
      );
    }

    return chapter.title || t("More lessons");
  };
}

function isSkipped(chapter: PlanChapterView): boolean {
  return chapter.skills.length > 0 || chapter.testedOut;
}

function isWritingAhead(chapter: PlanChapterView): boolean {
  return chapter.writing && !chapter.far && chapter.skills.length === 0;
}

function FoldedNames({ names }: { names: readonly string[] }) {
  return (
    <ul className="text-muted-foreground flex list-disc flex-col gap-1 pb-2 pl-7 text-sm">
      {names.map((name) => (
        <li key={name}>{name}</li>
      ))}
    </ul>
  );
}

/** Whether the list would name any chapter: lessons being written right now aren't rows yet. */
export function hasListedChapters(chapters: readonly PlanChapterView[]): boolean {
  return chapters.some((chapter) => !isWritingAhead(chapter));
}

function ChapterRow({
  chapter,
  isNext,
  links,
}: {
  chapter: PlanChapterView;
  isNext: boolean;
  links: JourneyPathLinks | null;
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
      ? t("Skipped · you already know it")
      : null) ??
    (chapter.deeper ? t("More on an earlier topic") : null);

  const content = (
    <>
      <span className={PATH_ROW_LEADING_CLASS} data-slot="path-row-mark">
        <ChapterMark chapter={chapter} isNext={isNext} skipped={isSkipped(chapter)} />
      </span>
      <PathRowBody>
        <span
          className={cn(
            "line-clamp-2 font-medium",
            chapter.state === "done" && "text-muted-foreground",
          )}
        >
          {title(chapter)}
        </span>
        {line && <span className="text-muted-foreground text-xs">{line}</span>}
      </PathRowBody>
    </>
  );

  if (links && chapter.writing && chapter.skillId && outlineActions) {
    return (
      <FarTopicSheet
        actions={outlineActions}
        chapterHref={links.chapter}
        lessons={chapter.plannedLessons}
        nextDate={chapter.nextDate}
        skillId={chapter.skillId}
        title={title(chapter)}
        trigger={
          <button
            className={cn(PATH_ROW_CLASS, "hover:bg-muted/70")}
            data-slot="path-row"
            type="button"
          />
        }
      >
        {content}
        <RowChevron />
      </FarTopicSheet>
    );
  }

  if (chapter.skills.length > 0) {
    return (
      <Collapsible>
        <CollapsibleTrigger
          className={cn(PATH_ROW_CLASS, "hover:bg-muted/70")}
          data-slot="path-row"
        >
          {content}
          <FoldChevron />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <FoldedNames names={chapter.skills} />
        </CollapsibleContent>
      </Collapsible>
    );
  }

  if (!links || !chapter.chapterId) {
    return (
      <div className={PATH_ROW_CLASS} data-slot="path-row">
        {content}
      </div>
    );
  }

  return (
    <LearnLink
      className={cn(PATH_ROW_CLASS, "hover:bg-muted/70")}
      data-highlighted={isNext || undefined}
      data-slot="path-row"
      href={links.chapter(chapter.chapterId)}
    >
      {content}
      <RowChevron />
    </LearnLink>
  );
}

function useShowMoreLabel({ hidden, showAll }: { hidden: number; showAll: boolean }) {
  const t = useExtracted();
  const { goal } = usePlanScreen();

  if (goal.kind === "language") {
    return showAll
      ? t("Show fewer units")
      : t("{count, plural, one {# more unit} other {# more units}}", { count: hidden });
  }

  return showAll
    ? t("Show fewer chapters")
    : t("{count, plural, one {# more chapter} other {# more chapters}}", { count: hidden });
}

/** The topics the plan's date leaves out of a phase or a module, folded under one row that names them. */
export function LeftOutTopicsRow({ names }: { names: readonly string[] }) {
  const label = useLeftOutTopicsLabel();

  return (
    <Collapsible>
      <CollapsibleTrigger className={cn(PATH_ROW_CLASS, "hover:bg-muted/70")} data-slot="path-row">
        <span className={PATH_ROW_LEADING_CLASS} data-slot="path-row-mark">
          <TopicMark mark={{ kind: "notPlanned" }} />
        </span>
        <PathRowBody>
          <span className="text-muted-foreground font-medium">{label(names.length)}</span>
        </PathRowBody>
        <FoldChevron />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <FoldedNames names={names} />
      </CollapsibleContent>
    </Collapsible>
  );
}

/** Without `links` the rows only say what's there, every one of them, and none opens anything. */
export function JourneyChapters({
  chapters,
  checkpoint,
  leftOut,
  links,
}: {
  chapters: PlanChapterView[];
  checkpoint: PlanPhaseCheckpointView | null;
  leftOut?: readonly string[];
  links: JourneyPathLinks | null;
}) {
  const [showAll, setShowAll] = useState(false);
  const listId = useId();
  const rows = chapters.filter((chapter) => !isWritingAhead(chapter));

  const range = links
    ? getChapterWindow({ states: rows.map((chapter) => chapter.state) })
    : { end: rows.length, start: 0 };

  const hidden = rows.length - (range.end - range.start);
  const shown = showAll ? rows : rows.slice(range.start, range.end);
  const showMoreLabel = useShowMoreLabel({ hidden, showAll });

  return (
    <ul className="flex flex-col" id={listId}>
      {shown.map((chapter) => (
        <li key={getChapterKey(chapter)}>
          <ChapterRow chapter={chapter} isNext={chapter.state === "current"} links={links} />
        </li>
      ))}

      {hidden > 0 && (
        <li>
          <FoldRow
            controls={listId}
            done={false}
            label={showMoreLabel}
            onToggle={() => setShowAll((open) => !open)}
            open={showAll}
          />
        </li>
      )}

      {leftOut && leftOut.length > 0 && (
        <li>
          <LeftOutTopicsRow names={leftOut} />
        </li>
      )}

      {checkpoint && links && (
        <li>
          <CheckpointRow checkpoint={checkpoint} links={links} />
        </li>
      )}
    </ul>
  );
}
