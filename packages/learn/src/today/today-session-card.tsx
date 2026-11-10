"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { type DayStep } from "../session/session-types";
import { BlockRow, PlusLessonRow } from "./today-block-row";
import { ComingLessonsRow } from "./today-coming-lessons";
import { useTodayScreen } from "./today-context";
import { DayMeta, DayProgress } from "./today-day-progress";
import { TodayDayStatus } from "./today-day-status";
import { FoldRow } from "./today-fold-row";
import { TodayFreshStart } from "./today-fresh-start";
import { SESSION_LIST_ID } from "./today-ids";
import { UPCOMING_ROWS, splitTodayQueue } from "./today-queue";
import { getFoldMinutes } from "./today-time";
import { TodayUpNext } from "./today-up-next";

const DONE_ROWS = 1;

function SessionQueue({ next }: { next: DayStep }) {
  const t = useExtracted();
  const { today } = useTodayScreen();
  const { blocks, lessonsComing, lessonsToPrepare, minutes, plusLessons } = today.session;
  const [doneOpen, setDoneOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const { after, before, done } = splitTodayQueue({ blocks, nextPosition: next.position });
  const foldsDone = done.length > DONE_ROWS;

  const lessonsAhead = lessonsComing || lessonsToPrepare;
  const coming = Number(lessonsAhead);
  const more = after.length + coming + plusLessons.length - UPCOMING_ROWS;

  const plusRows = moreOpen
    ? plusLessons.length
    : Math.max(0, UPCOMING_ROWS - after.length - coming);

  return (
    <div className="flex flex-col" data-slot="today-session-list">
      {foldsDone && (
        <FoldRow
          done
          label={t("{count, plural, one {# done} other {# done}}", { count: done.length })}
          onToggle={() => setDoneOpen((open) => !open)}
          open={doneOpen}
        />
      )}

      <ol className="flex flex-col" id={SESSION_LIST_ID}>
        {(!foldsDone || doneOpen) &&
          done.map((block) => <BlockRow block={block} isNext={false} key={block.position} />)}

        {before.map((block) => (
          <BlockRow block={block} isNext={false} key={block.position} />
        ))}

        <BlockRow block={next} isNext />

        {(moreOpen ? after : after.slice(0, UPCOMING_ROWS)).map((block) => (
          <BlockRow block={block} isNext={false} key={block.position} />
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
          minutes={
            moreOpen
              ? undefined
              : getFoldMinutes({
                  hasHiddenRows: after.length + coming > UPCOMING_ROWS,
                  left: minutes.left,
                  shown: [...before, next, ...after.slice(0, UPCOMING_ROWS)],
                })
          }
          onToggle={() => setMoreOpen((open) => !open)}
          open={moreOpen}
        />
      )}
    </div>
  );
}

function DayQueue() {
  const { today } = useTodayScreen();
  const { blocks, plusLessons } = today.session;

  if (blocks.length === 0 && plusLessons.length === 0) {
    return null;
  }

  return (
    <ol className="flex flex-col" data-slot="today-session-list">
      {blocks.map((block) => (
        <BlockRow block={block} isNext={false} key={block.position} opens={false} />
      ))}

      {plusLessons.map((lesson, index) => (
        // oxlint-disable-next-line react/no-array-index-key -- two plan items can share a title, and a read replaces the list whole.
        <PlusLessonRow key={index} title={lesson.title} />
      ))}
    </ol>
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
      <TodayFreshStart className="mb-4" />
      <DayProgress />
      <DayMeta className="mt-2" />

      <div className="mt-3 flex flex-col first:mt-0 empty:hidden">
        {next ? <SessionQueue next={next} /> : <DayQueue />}
      </div>

      <TodayDayStatus className="mt-3 first:mt-0" />
      <TodayUpNext className="mt-6" />
    </div>
  );
}
