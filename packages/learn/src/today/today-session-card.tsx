"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { type StudyBlock } from "../session/session-types";
import { BlockRow, type RowFold } from "./today-block-row";
import { useTodayScreen } from "./today-context";
import { DayMeta, DayProgress } from "./today-day-progress";
import { TodayDayStatus } from "./today-day-status";
import { FoldRow } from "./today-fold-row";
import { TodayFreshStart } from "./today-fresh-start";
import { SESSION_LIST_ID } from "./today-ids";
import { splitTodayQueue } from "./today-queue";

/** Done blocks a phone shows before folding them into one row ("✓ 3 done · 14 min"). */
const PHONE_DONE_ROWS = 2;

/** Blocks after the next one a phone shows before folding the rest ("+3 more · 14 min"). */
const PHONE_UPCOMING_ROWS = 6;

/** From `sm` the whole day shows, unless it's longer than this after the next block. */
const WIDE_UPCOMING_ROWS = 12;

/**
 * How many parts the day holds so far, while its lessons are still being outlined: each block the
 * learner opens prepares the next ones. "More on the way" read as a delivery already running, and
 * an IELTS learner waited 40 minutes on a 45-minute day that showed 15.
 */
function useDaySoFar(blocks: readonly StudyBlock[]): string {
  const t = useExtracted();
  const count = blocks.length;

  return blocks.every((block) => block.kind === "learn")
    ? t("{count, plural, one {# lesson} other {# lessons}} so far · more as you go", { count })
    : t("{count, plural, one {# activity} other {# activities}} so far · more as you go", {
        count,
      });
}

function sumMinutes(blocks: readonly StudyBlock[]): number {
  return blocks.reduce((total, block) => total + block.estimatedMinutes, 0);
}

/** Whether an upcoming row hides behind the "+N more" fold, on a phone and from `sm`. */
function getUpcomingFold({ index, open }: { index: number; open: boolean }): RowFold {
  return { hidden: !open, phone: index >= PHONE_UPCOMING_ROWS, wide: index >= WIDE_UPCOMING_ROWS };
}

/**
 * The day as a queue, flat on the page: every block, the next one highlighted. A phone keeps the
 * day on its first screen: more than two blocks done fold into one row, and past six after the
 * next one the rest fold into "+3 more". From `sm` the whole day shows (a day longer than 12 after
 * the next block folds the rest the same way).
 */
function SessionQueue({ next }: { next: StudyBlock }) {
  const t = useExtracted();
  const { today } = useTodayScreen();
  const { blocks, lessonsComing } = today.session;
  const daySoFar = useDaySoFar(blocks);
  const [doneOpen, setDoneOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const { after, before, done } = splitTodayQueue({ blocks, nextId: next.id });
  const foldsDone = done.length > PHONE_DONE_ROWS;
  const phoneMore = after.slice(PHONE_UPCOMING_ROWS);
  const wideMore = after.slice(WIDE_UPCOMING_ROWS);

  return (
    <div className="flex flex-col" data-slot="today-session-list">
      {foldsDone && (
        <FoldRow
          className="sm:hidden"
          done
          label={t("{count, plural, one {# done} other {# done}}", { count: done.length })}
          minutes={sumMinutes(done)}
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
            key={block.id}
          />
        ))}

        {before.map((block) => (
          <BlockRow block={block} isNext={false} key={block.id} />
        ))}

        <BlockRow block={next} isNext />

        {after.map((block, index) => (
          <BlockRow
            block={block}
            fold={getUpcomingFold({ index, open: moreOpen })}
            isNext={false}
            key={block.id}
          />
        ))}
      </ol>

      {phoneMore.length > 0 && (
        <FoldRow
          className="sm:hidden"
          done={false}
          label={t("+{count, number} more", { count: phoneMore.length })}
          minutes={sumMinutes(phoneMore)}
          onToggle={() => setMoreOpen((open) => !open)}
          open={moreOpen}
        />
      )}

      {wideMore.length > 0 && (
        <FoldRow
          className="max-sm:hidden"
          done={false}
          label={t("+{count, number} more", { count: wideMore.length })}
          minutes={sumMinutes(wideMore)}
          onToggle={() => setMoreOpen((open) => !open)}
          open={moreOpen}
        />
      )}

      {lessonsComing && (
        <p className="text-muted-foreground pt-2 font-mono text-xs tabular-nums">{daySoFar}</p>
      )}
    </div>
  );
}

/**
 * The day's queue once there's nothing to start (it's done, or today's study time ran out): every
 * block, the done ones with their check, so the learner sees what they did. Nothing opens from it.
 */
function DayQueue() {
  const { today } = useTodayScreen();
  const { blocks } = today.session;

  if (blocks.length === 0) {
    return null;
  }

  return (
    <ol className="flex flex-col" data-slot="today-session-list">
      {blocks.map((block) => (
        <BlockRow block={block} isNext={false} key={block.id} opens={false} />
      ))}
    </ol>
  );
}

/** The block to go on with; null once the day's blocks are done. */
function useNextBlock(): StudyBlock | null {
  const { today } = useTodayScreen();
  const { blocks, nextBlockId } = today.session;

  return blocks.find((block) => block.id === nextBlockId) ?? null;
}

/**
 * Today's session, flat on the page under Today's title: why the day is lighter (once), the day's
 * segments with how far along it is, its blocks as a queue with the next one highlighted, and
 * one line on what the day is when there's nothing to start (done, a rest day, the study time used
 * up, nothing new, or lessons still being prepared). The day's main action sits beside the title
 * from `sm` and under the queue on a phone (`TodayAction`).
 */
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
    </div>
  );
}
