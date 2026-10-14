"use client";

import { Button } from "@zoonk/ui/components/button";
import { useExtracted } from "next-intl";
import { useEffect, useEffectEvent, useRef } from "react";
import { EnterButton } from "../_components/enter-button";
import { type LessonNotWritten } from "../_components/lesson-not-written-notice";
import { TaskActionBar, TaskActions, TaskBody } from "../_components/task-layout";
import { TaskMeta } from "../_components/task-meta";
import { useFormatDuration } from "../_utils/time-format";
import { AlternativeButton, NotWritten, Waiting } from "./next-stop-wait";
import { SessionFrame } from "./session-frame";
import { SessionHeader } from "./session-header";
import { useSessionQueueAside } from "./session-queue";
import { getSessionQueue } from "./session-queue-rows";
import { type StudyBlock } from "./session-types";
import { useBlockDetail, useBlockTitle } from "./use-block-copy";
import { useSessionAction } from "./use-session-action";

/**
 * Where the next stop's lesson stands: `writing` while a run writes it, `notStarted` until the
 * run asked for it picks it up, and `failed` when writing it stopped.
 */
export type NextStopLesson = "failed" | "notStarted" | "ready" | "writing";

export type NextStopActions = {
  /** Records how long the learner waited for a lesson before it opened ("Generation Waited"). */
  recordWait?: (milliseconds: number) => void;
  /** Checks again whether the lesson is ready (the host re-reads the session). */
  refresh: () => void;
  /** Opens an already-written lesson without requesting more generation. */
  openWrittenLesson?: (blockId: string) => Promise<boolean>;
  start: (blockId: string) => Promise<boolean>;
  stop: () => Promise<boolean>;
};

function StartButton({
  block,
  start,
}: {
  block: StudyBlock;
  start: ReturnType<typeof useSessionAction>;
}) {
  const t = useExtracted();

  return (
    <EnterButton disabled={start.isPending} onClick={start.run}>
      {block.status === "active" ? t("Continue") : t("Start")}
    </EnterButton>
  );
}

/**
 * Once the lesson the learner waited for is written, it opens on its own: they already asked for
 * it. A lesson that was ready when the screen opened waits for their Start.
 */
function useOpenWhenWritten({
  actions,
  block,
  lesson,
}: {
  actions: NextStopActions;
  block: StudyBlock;
  lesson: NextStopLesson;
}) {
  // When the wait began, or null while nothing is being waited for.
  const waitedSince = useRef<number | null>(null);

  const onWritten = useEffectEvent((since: number) => {
    actions.recordWait?.(Date.now() - since);
    void actions.openWrittenLesson?.(block.id);
  });

  useEffect(() => {
    if (lesson !== "ready") {
      waitedSince.current ??= Date.now();
      return;
    }

    const since = waitedSince.current;

    if (since !== null) {
      waitedSince.current = null;
      onWritten(since);
    }
  }, [lesson]);
}

/**
 * The session's next step when it isn't open yet, with the same chrome as every task: the day's
 * bar in the header, then the step on the page (its name as the title, what it holds, its minutes
 * in mono) and Start (or Enter) in the action bar, beside "Stop for today" between blocks. A lesson
 * still being written never leaves a dead end: the wait updates live, a ready block can come first
 * (as the main action), the lesson opens on its own once written, and writing that stopped can be
 * asked for again. A lesson that won't be written now (a limit, or set aside) says why instead of
 * waiting, with a ready block to do instead. From `lg` the aside lists the day's queue.
 */
export function NextStop({
  actions,
  alternative,
  block,
  blocks,
  exitHref,
  generationId,
  lesson,
  lessonsComing = false,
  notWritten,
  sessionBar,
}: {
  actions: NextStopActions;
  /** A ready block the learner can do while a lesson is written. */
  alternative: StudyBlock | null;
  block: StudyBlock;
  /** The day's blocks, for its queue beside the next stop. */
  blocks: readonly StudyBlock[];
  exitHref: string;
  /** The run writing the block's lesson, when one does: the wait follows its progress. */
  generationId: string | null;
  /** Where the block's lesson stands; `ready` for blocks without one. */
  lesson: NextStopLesson;
  /** The day holds time for lessons still being outlined, which join its end once they land. */
  lessonsComing?: boolean;
  /** Why the block's lesson won't be written now, when the learner's request was turned down. */
  notWritten: LessonNotWritten | null;
  sessionBar: { completed: number; total: number };
}) {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const title = useBlockTitle();
  const detail = useBlockDetail();
  const isReady = lesson === "ready";
  const start = useSessionAction({ action: () => actions.start(block.id), enterKey: isReady });
  const stop = useSessionAction({ action: actions.stop });
  const line = detail(block);
  const canStop = sessionBar.completed > 0;
  const hasActions = isReady || alternative !== null || canStop;
  const queue = getSessionQueue({ blocks, nextId: block.id });
  const aside = useSessionQueueAside(queue);

  useOpenWhenWritten({ actions, block, lesson });

  const facts = [
    formatDuration(block.estimatedMinutes),
    // A topic the exam board asks a lot, from past papers.
    block.oftenTested && t("Often tested"),
  ];

  return (
    <SessionFrame aside={aside}>
      <SessionHeader
        exitHref={exitHref}
        lessonsComing={lessonsComing}
        queue={queue.rows}
        sessionBar={sessionBar}
      />

      <TaskBody data-slot="next-stop">
        <div className="flex flex-col gap-2">
          <p className="text-label">{t("Up next")}</p>
          <h2 className="text-title">{title(block)}</h2>
          {line && <p className="text-muted-foreground text-sm text-balance">{line}</p>}
          <TaskMeta facts={facts} />
        </div>

        {!isReady && notWritten && (
          <NotWritten actions={actions} block={block} reason={notWritten} />
        )}

        {!isReady && !notWritten && (
          <Waiting actions={actions} block={block} generationId={generationId} lesson={lesson} />
        )}
      </TaskBody>

      {hasActions && (
        <TaskActionBar>
          {start.failed && (
            <p className="text-destructive-text text-sm" role="alert">
              {t("We couldn't open this step. Try again.")}
            </p>
          )}

          {stop.failed && (
            <p className="text-destructive-text text-sm" role="alert">
              {t("We couldn't stop the session. Try again.")}
            </p>
          )}

          <TaskActions>
            {canStop && (
              <Button disabled={stop.isPending} onClick={stop.run} size="xl" variant="outline">
                {t("Stop for today")}
              </Button>
            )}

            {isReady && <StartButton block={block} start={start} />}

            {!isReady && alternative && (
              <AlternativeButton
                actions={actions}
                alternative={alternative}
                reason={notWritten ? "instead" : "whileWaiting"}
              />
            )}
          </TaskActions>
        </TaskActionBar>
      )}
    </SessionFrame>
  );
}
