"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { type DayStep } from "../session/session-types";
import { BlockRow, PlusLessonRow, type RowFold, useCountsTowardMission } from "./today-block-row";
import { ComingLessonsRow } from "./today-coming-lessons";
import { useTodayScreen } from "./today-context";
import { DayMeta, DayProgress } from "./today-day-progress";
import { TodayDayStatus } from "./today-day-status";
import { FoldRow } from "./today-fold-row";
import { TodayFreshStart } from "./today-fresh-start";
import { SESSION_LIST_ID } from "./today-ids";
import { splitTodayQueue } from "./today-queue";
import { TodayUpNext } from "./today-up-next";

const PHONE_DONE_ROWS = 2;

const PHONE_UPCOMING_ROWS = 6;

const WIDE_UPCOMING_ROWS = 12;

function sumMinutes(blocks: readonly DayStep[]): number {
  return blocks.reduce((total, block) => total + block.estimatedMinutes, 0);
}

type UpcomingRows = { phone: number; wide: number };

function getUpcomingFold({
  index,
  open,
  rows,
}: {
  index: number;
  open: boolean;
  rows: UpcomingRows;
}): RowFold {
  return { hidden: !open, phone: index >= rows.phone, wide: index >= rows.wide };
}

/**
 * The fold never hides a block a mission opens: where the missions card leaves its rows to the
 * queue, that block is the mission's one place.
 */
function SessionQueue({ next }: { next: DayStep }) {
  const t = useExtracted();
  const { today } = useTodayScreen();
  const { blocks, lessonsComing, plusLessons } = today.session;
  const [doneOpen, setDoneOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const countsTowardMission = useCountsTowardMission();
  const { after, before, done } = splitTodayQueue({ blocks, nextPosition: next.position });
  const foldsDone = done.length > PHONE_DONE_ROWS;
  const marked = after.findLastIndex((block) => countsTowardMission(block)) + 1;

  const rows = {
    phone: Math.max(PHONE_UPCOMING_ROWS, marked),
    wide: Math.max(WIDE_UPCOMING_ROWS, marked),
  };

  const coming = lessonsComing ? 1 : 0;
  const upcoming = after.length + coming + plusLessons.length;
  const phoneMore = Math.max(0, upcoming - rows.phone);
  const wideMore = Math.max(0, upcoming - rows.wide);

  return (
    <div className="flex flex-col" data-slot="today-session-list">
      {foldsDone && (
        <FoldRow
          className="sm:hidden"
          done
          label={t("{count, plural, one {# done} other {# done}}", { count: done.length })}
          onToggle={() => setDoneOpen((open) => !open)}
          open={doneOpen}
        />
      )}

      <ol className="flex flex-col" id={SESSION_LIST_ID}>
        {done.map((block) => (
          <BlockRow
            block={block}
            fold={{ hidden: foldsDone && !doneOpen, phone: true, wide: false }}
            isNext={false}
            key={block.position}
          />
        ))}

        {before.map((block) => (
          <BlockRow block={block} isNext={false} key={block.position} />
        ))}

        <BlockRow block={next} isNext />

        {after.map((block, index) => (
          <BlockRow
            block={block}
            fold={getUpcomingFold({ index, open: moreOpen, rows })}
            isNext={false}
            key={block.position}
          />
        ))}

        {lessonsComing && (
          <ComingLessonsRow fold={getUpcomingFold({ index: after.length, open: moreOpen, rows })} />
        )}

        {plusLessons.map((lesson, index) => (
          <PlusLessonRow
            fold={getUpcomingFold({ index: after.length + coming + index, open: moreOpen, rows })}
            // oxlint-disable-next-line react/no-array-index-key -- two plan items can share a title, and a read replaces the list whole.
            key={index}
            title={lesson.title}
          />
        ))}
      </ol>

      {phoneMore > 0 && (
        <FoldRow
          className="sm:hidden"
          done={false}
          label={t("{count, plural, one {+# more} other {+# more}}", { count: phoneMore })}
          minutes={sumMinutes(after.slice(rows.phone))}
          onToggle={() => setMoreOpen((open) => !open)}
          open={moreOpen}
        />
      )}

      {wideMore > 0 && (
        <FoldRow
          className="max-sm:hidden"
          done={false}
          label={t("{count, plural, one {+# more} other {+# more}}", { count: wideMore })}
          minutes={sumMinutes(after.slice(rows.wide))}
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
  const { today } = useTodayScreen();
  const limitReached = today.session.dailyLimit?.reached === true;

  return (
    <div className={cn("flex min-w-0 flex-col", className)} data-slot="today-session">
      <TodayFreshStart className="mb-4" />
      <DayProgress />
      <DayMeta className="mt-2" />

      <div className="mt-3 flex flex-col first:mt-0 empty:hidden">
        {next && !limitReached ? <SessionQueue next={next} /> : <DayQueue />}
      </div>

      <TodayDayStatus className="mt-3 first:mt-0" />
      <TodayUpNext className="mt-6" />
    </div>
  );
}
