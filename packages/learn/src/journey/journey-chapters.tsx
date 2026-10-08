"use client";

import {
  type PlanChapterView,
  type PlanPhaseCheckpointView,
} from "@zoonk/core/plans/view-contract";
import { cn } from "@zoonk/ui/lib/utils";
import { MinusIcon, PlusIcon } from "lucide-react";
import { useExtracted, useFormatter } from "next-intl";
import { useState } from "react";
import { ChapterMark } from "../_components/chapter-mark";
import { LearnLink } from "../learn-link";
import { usePlanScreen } from "../plan/plan-context";
import { getChapterWindow } from "./chapter-window";
import { type JourneyPathLinks } from "./journey-links";
import { CheckpointRow, PATH_ROW_CLASS, PATH_ROW_LEADING_CLASS } from "./journey-phase-events";

/** Rows without a chapter (lessons being written, or settled) differ by their kind and name. */
function getChapterKey(chapter: PlanChapterView): string {
  return chapter.chapterId ?? `${chapter.writing ? "writing" : "settled"}:${chapter.title}`;
}

/**
 * A chapter's name: a settled row of skills is named by them, not by its course. Lessons still
 * being written go by their course, which for a language goal is the language itself, so those
 * are just "More lessons".
 */
function useChapterTitle() {
  const t = useExtracted();
  const format = useFormatter();
  const { goal } = usePlanScreen();

  return (chapter: PlanChapterView): string => {
    if (chapter.skills.length > 0) {
      return format.list(chapter.skills);
    }

    if (chapter.writing && goal.kind === "language") {
      return t("More lessons");
    }

    return chapter.title || t("More lessons");
  };
}

/**
 * One chapter of the path: done, the next one (its tile and "Next", the page's obvious target) or
 * ahead. Its page opens on tap; lessons still being written have no page yet, so their row only
 * says so.
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

  const content = (
    <>
      <span className={PATH_ROW_LEADING_CLASS}>
        <ChapterMark chapter={chapter} isNext={isNext} />
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
        {chapter.writing && (
          <span className="text-muted-foreground text-xs">{t("Lessons on the way")}</span>
        )}
      </span>
      {isNext && (
        <span className="bg-primary text-primary-foreground shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium">
          {t("Up next")}
        </span>
      )}
    </>
  );

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
