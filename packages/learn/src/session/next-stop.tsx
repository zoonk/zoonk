"use client";

import { Button } from "@zoonk/ui/components/button";
import { useExtracted } from "next-intl";
import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from "react";
import { EnterButton } from "../_components/enter-button";
import { type LessonNotWritten } from "../_components/lesson-not-written-notice";
import { OpeningWaitLine } from "../_components/opening-wait-line";
import { TaskActionBar, TaskActions, TaskBody } from "../_components/task-layout";
import { TaskMeta } from "../_components/task-meta";
import { useFormatDuration } from "../_utils/time-format";
import { useSlowWait } from "../_utils/use-slow-wait";
import { AlternativeButton, NotWritten, Waiting } from "./next-stop-wait";
import { SessionFrame } from "./session-frame";
import { SessionHeader } from "./session-header";
import { useSessionQueueAside } from "./session-queue";
import { getSessionQueue } from "./session-queue-rows";
import { type DayStep } from "./session-types";
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
  openWrittenLesson?: (step: DayStep) => Promise<boolean>;
  /** Starts a step: this one, or a ready one to do while its lesson is written. */
  start: (step: DayStep) => Promise<boolean>;
  stop: () => Promise<boolean>;
};

/**
 * The learner's tap that opens this step, when it was made before this screen drew it (Today's
 * Start, one of its rows, or this screen while its content was on its way): the step is busy from
 * that tap, its wait lines count from it, and its main action takes the focus the tapped control
 * had. A tap that failed leaves the step's retry line, with Start ready again.
 */
export type NextStopTap = {
  /** The tapped control had focus, so this step's main action takes it. */
  focus: boolean;
  state: "failed" | "opening";
  /** When the learner tapped (`Date.now()`). */
  tappedAt: number;
};

/**
 * Whether the page's focus is nowhere the learner can see: none, the page itself, or a control that
 * left with the screen it was on (a hidden route keeps its nodes, hidden, until the browser blurs).
 */
function isFocusLost(active: Element | null): boolean {
  return (
    active === null ||
    active === document.body ||
    (active instanceof HTMLElement && !active.checkVisibility())
  );
}

/**
 * The main action takes focus when it's drawn for a tap whose control had it, and the focus is
 * nowhere the learner can see now (the tapped control left with its screen, or with the screen
 * this one replaced).
 */
function useTapFocus(focus: boolean) {
  const ref = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    if (focus && isFocusLost(document.activeElement)) {
      ref.current?.focus({ preventScroll: true });
    }
  }, [focus]);

  return ref;
}

function StartButton({
  busy,
  focus,
  onClick,
  step,
}: {
  busy: boolean;
  focus: boolean;
  onClick: () => void;
  step: DayStep;
}) {
  const t = useExtracted();
  const ref = useTapFocus(focus);

  return (
    <EnterButton
      aria-busy={busy || undefined}
      disabled={busy}
      focusableWhenDisabled
      onClick={onClick}
      ref={ref}
    >
      {step.status === "active" ? t("Continue") : t("Start")}
    </EnterButton>
  );
}

/**
 * Once the lesson the learner waited for is written, it opens on its own: they already asked for
 * it. A lesson that was ready when the screen opened waits for their Start.
 */
function useOpenWhenWritten({
  actions,
  asked,
  lesson,
  open,
}: {
  actions: NextStopActions;
  asked: boolean;
  lesson: NextStopLesson;
  /** Opens the written lesson, with the action bar busy until it's open. */
  open: () => void;
}) {
  // When the wait began, or null while nothing is being waited for.
  const waitedSince = useRef<number | null>(null);

  const onWritten = useEffectEvent((since: number) => {
    actions.recordWait?.(Date.now() - since);
    open();
  });

  // A lesson the learner already asked for counts as waited for, so one written before the
  // screen showed it (by then, or while the request was answered) opens too.
  useEffect(() => {
    if (lesson !== "ready") {
      waitedSince.current ??= Date.now();
      return;
    }

    const since = waitedSince.current ?? (asked ? Date.now() : null);

    if (since !== null) {
      waitedSince.current = null;
      onWritten(since);
    }
  }, [asked, lesson]);
}

/**
 * Start's state: busy from the learner's own press, from the tap that's opening the step (wherever
 * it was made, its wait counted from the tap), or while the lesson opens on its own once written;
 * failed when any of them didn't work, until the learner presses again.
 */
function useStartState({
  actions,
  block,
  isReady,
  tap,
  written,
}: {
  actions: NextStopActions;
  block: DayStep;
  isReady: boolean;
  tap: NextStopTap | null;
  written: { failed: boolean; isPending: boolean };
}) {
  const tapOpening = tap?.state === "opening";
  const opening = tapOpening || written.isPending;

  const start = useSessionAction({
    action: () => actions.start(block),
    enterKey: isReady && !opening,
  });

  const busy = start.isPending || opening;

  // An earlier failure says nothing while a new attempt is under way.
  const failed =
    start.failed || ((tap?.state === "failed" || written.failed) && !start.isPending && !opening);

  // The tap's wait goes on through what opens the step after it (its lesson, written meanwhile),
  // so its line neither starts over nor blinks when the tap hands over.
  const [tappedAt, setTappedAt] = useState<number>();

  if (tapOpening && tappedAt !== tap.tappedAt) {
    setTappedAt(tap.tappedAt);
  } else if (!busy && tappedAt !== undefined) {
    setTappedAt(undefined);
  }

  const wait = useSlowWait(busy, { since: tapOpening ? tap.tappedAt : tappedAt });

  return { busy, failed, run: start.run, wait };
}

/**
 * The next step's action bar: Start (or Continue, and Enter) when the step is ready, or a ready
 * block to do while its lesson is written, beside "Stop for today" between blocks. Start is busy
 * from the tap that's opening the step (`tap`), wherever it was made, keeps the focus the tapped
 * control had, and says how the wait goes, counted from the tap; a tap that failed says so here.
 */
function NextStopActionBar({
  actions,
  alternative,
  block,
  isReady,
  notWritten,
  sessionBar,
  tap,
  written,
}: {
  actions: NextStopActions;
  alternative: DayStep | null;
  block: DayStep;
  isReady: boolean;
  notWritten: LessonNotWritten | null;
  sessionBar: { completed: number; total: number };
  tap: NextStopTap | null;
  /** Opening the lesson once it's written, on its own: busy like Start, and failing like it. */
  written: { failed: boolean; isPending: boolean };
}) {
  const t = useExtracted();
  const start = useStartState({ actions, block, isReady, tap, written });
  const stop = useSessionAction({ action: actions.stop });
  const canStop = sessionBar.completed > 0;

  if (!isReady && !alternative && !canStop) {
    return null;
  }

  return (
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

      {/* Empty, it takes back the bar's gap but stays in the page, so it's heard when it speaks. */}
      <OpeningWaitLine className="text-sm empty:-mt-2" wait={start.wait} />

      <TaskActions>
        {canStop && (
          <Button disabled={stop.isPending} onClick={stop.run} size="xl" variant="outline">
            {t("Stop for today")}
          </Button>
        )}

        {isReady && (
          <StartButton
            busy={start.busy}
            focus={Boolean(tap?.focus)}
            onClick={start.run}
            step={block}
          />
        )}

        {!isReady && alternative && (
          <AlternativeButton
            actions={actions}
            alternative={alternative}
            reason={notWritten ? "instead" : "whileWaiting"}
          />
        )}
      </TaskActions>
    </TaskActionBar>
  );
}

/**
 * The session's next step when it isn't open yet, with the same chrome as every task: the day's
 * bar in the header, then the step on the page (its name as the title, what it holds, its minutes
 * in mono) and the action bar (`NextStopActionBar`). A step a tap is opening (`tap`) is drawn busy
 * from that tap, the same before and after its screen's own content arrives, so its wait line, its
 * busy Start and its focus carry over. A lesson still being written never leaves a dead end: the
 * wait updates live, a ready block can come first (as the main action), the lesson opens on its own
 * once written, and writing that stopped can be asked for again. A lesson that won't be written now
 * (a limit, or set aside) says why instead of waiting, with a ready block to do instead. From `lg`
 * the aside lists the day's queue.
 */
export function NextStop({
  actions,
  alternative,
  asked = false,
  block,
  blocks,
  exitHref,
  generationId,
  lesson,
  lessonsComing = false,
  notWritten,
  sessionBar,
  tap = null,
}: {
  actions: NextStopActions;
  /** A ready block the learner can do while a lesson is written. */
  alternative: DayStep | null;
  /** The learner's tap already asked for the block's lesson: once it's written, it opens. */
  asked?: boolean;
  block: DayStep;
  /** The day's blocks, for its queue beside the next stop. */
  blocks: readonly DayStep[];
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
  tap?: NextStopTap | null;
}) {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const title = useBlockTitle();
  const detail = useBlockDetail();
  const isReady = lesson === "ready";
  const line = detail(block);
  const queue = getSessionQueue({ blocks, nextPosition: block.position });
  const aside = useSessionQueueAside(queue);

  const written = useSessionAction({
    action: () => actions.openWrittenLesson?.(block) ?? Promise.resolve(false),
  });

  useOpenWhenWritten({ actions, asked, lesson, open: written.run });

  // A lesson the learner asked for that's written opens on its own now: busy from that moment, not
  // only once its request is out, so nothing looks idle between the tap and the open.
  const writtenOpening = written.isPending || (asked && isReady && !written.failed);

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

      <NextStopActionBar
        actions={actions}
        alternative={alternative}
        block={block}
        isReady={isReady}
        notWritten={notWritten}
        sessionBar={sessionBar}
        tap={tap}
        written={{ failed: written.failed, isPending: writtenOpening }}
      />
    </SessionFrame>
  );
}
