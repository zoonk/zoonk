"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { type DayStep } from "../session/session-types";
import { BlockRow, PlusLessonRow } from "./today-block-row";
import { ComingLessonsRow } from "./today-coming-lessons";
import { useTodayScreen } from "./today-context";
import { DayOpenStatus, DayProgress } from "./today-day-progress";
import { TodayDayStatus } from "./today-day-status";
import { FoldRow } from "./today-fold-row";
import { SESSION_LIST_ID } from "./today-ids";
import { UPCOMING_ROWS, splitTodayQueue } from "./today-queue";
import { TodayUpNext } from "./today-up-next";

const DONE_ROWS = 1;

/** Opened rows land above "Show less", so focus moves to the first of them. */
function focusRow(row: Element | null | undefined) {
  if (!(row instanceof HTMLElement)) {
    return;
  }

  const target = row.querySelector<HTMLElement>("a[href], button:not(:disabled)");

  if (target) {
    target.focus();
    return;
  }

  row.tabIndex = -1;
  row.focus();
}

/** Skipped blocks fold in with the done ones, so the row says which is which. */
function useDoneFoldLabel(done: readonly DayStep[]): string {
  const t = useExtracted();
  const skipped = done.filter((block) => block.status === "skipped").length;
  const completed = done.length - skipped;

  if (skipped === 0) {
    return t("{count, plural, one {# done} other {# done}}", { count: completed });
  }

  if (completed === 0) {
    return t({
      description: "Counts blocks of today's study session the learner skipped.",
      message: "{count, plural, one {# skipped} other {# skipped}}",
      values: { count: skipped },
    });
  }

  return t({
    description: "Counts blocks of today's study session the learner finished and skipped.",
    message:
      "{completed, plural, one {# done} other {# done}} · {skipped, plural, one {# skipped} other {# skipped}}",
    values: { completed, skipped },
  });
}

function SessionQueue({ next }: { next: DayStep | null }) {
  const t = useExtracted();
  const { today } = useTodayScreen();
  const { blocks, lessonsComing, lessonsToPrepare, plusLessons } = today.session;
  const [doneOpen, setDoneOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const listRef = useRef<HTMLOListElement>(null);
  const revealFrom = useRef<number | null>(null);
  const opens = next !== null;
  const { after, before, done } = splitTodayQueue({ blocks, nextPosition: next?.position ?? null });
  const foldsDone = done.length > DONE_ROWS;
  const doneLabel = useDoneFoldLabel(done);

  // Activity keeps state while Today hides, so every visit starts folded.
  useLayoutEffect(
    () => () => {
      setDoneOpen(false);
      setMoreOpen(false);
    },
    [],
  );

  useEffect(() => {
    const from = revealFrom.current;
    revealFrom.current = null;

    if (moreOpen && from !== null) {
      focusRow(listRef.current?.children.item(from));
    }
  }, [moreOpen]);

  const lessonsAhead = opens && (lessonsComing || lessonsToPrepare);
  const coming = Number(lessonsAhead);
  const more = after.length + coming + plusLessons.length - UPCOMING_ROWS;

  const plusRows = moreOpen
    ? plusLessons.length
    : Math.max(0, UPCOMING_ROWS - after.length - coming);

  const toggleMore = () => {
    revealFrom.current = moreOpen ? null : (listRef.current?.children.length ?? null);
    setMoreOpen(!moreOpen);
  };

  if (blocks.length === 0 && plusLessons.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col" data-slot="today-session-list">
      {foldsDone && (
        <FoldRow
          done
          label={doneLabel}
          onToggle={() => setDoneOpen((open) => !open)}
          open={doneOpen}
        />
      )}

      <ol className="flex flex-col" id={SESSION_LIST_ID} ref={listRef}>
        {(!foldsDone || doneOpen) &&
          done.map((block) => <BlockRow block={block} isNext={false} key={block.position} />)}

        {before.map((block) => (
          <BlockRow block={block} isNext={false} key={block.position} />
        ))}

        {next && <BlockRow block={next} isNext />}

        {(moreOpen ? after : after.slice(0, UPCOMING_ROWS)).map((block) => (
          <BlockRow block={block} isNext={false} key={block.position} opens={opens} />
        ))}

        {lessonsAhead && (moreOpen || after.length < UPCOMING_ROWS) && <ComingLessonsRow />}

        {plusLessons.slice(0, plusRows).map((lesson, index) => (
          // oxlint-disable-next-line react/no-array-index-key -- two plan items can share a title, and a read replaces the list whole.
          <PlusLessonRow key={index} title={lesson.title} />
        ))}
      </ol>

      {more > 0 && (
        <FoldRow
          done={false}
          label={
            moreOpen
              ? t("Show less")
              : t("{count, plural, one {+# more} other {+# more}}", { count: more })
          }
          onToggle={toggleMore}
          open={moreOpen}
        />
      )}
    </div>
  );
}

function useNextBlock(): DayStep | null {
  const { today } = useTodayScreen();
  const { blocks, nextPosition } = today.session;

  return blocks.find((block) => block.position === nextPosition) ?? null;
}

export function TodaySession({ className }: { className?: string }) {
  const next = useNextBlock();

  return (
    <div className={cn("flex min-w-0 flex-col", className)} data-slot="today-session">
      <DayProgress />
      <DayOpenStatus className="mt-2" />

      <div className="mt-3 flex flex-col first:mt-0 empty:hidden" data-slot="today-list">
        <SessionQueue next={next} />
      </div>

      {/* After the list, the line's top hairline closes the last row; with no list, it opens the day. */}
      <TodayDayStatus className="mt-3 first:mt-0 [[data-slot=today-list]+&]:mt-0" />
      <TodayUpNext className="mt-6" />
    </div>
  );
}
