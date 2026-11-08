"use client";

import { type WarmUpDeck } from "@zoonk/core/library/warm-ups/contract";
import { Button } from "@zoonk/ui/components/button";
import { CircleStopIcon, PlayIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useLayoutEffect, useRef, useState } from "react";
import { EnterButton } from "../_components/enter-button";
import { type LessonNotWritten } from "../_components/lesson-not-written-notice";
import { OpeningWaitLine } from "../_components/opening-wait-line";
import { PageEyebrow } from "../_components/page";
import { StatusRegion } from "../_components/status-region";
import { TaskActionBar, TaskActions, TaskBody } from "../_components/task-layout";
import { TaskMeta } from "../_components/task-meta";
import { isFocusLost } from "../_utils/is-focus-lost";
import { useFormatDuration } from "../_utils/time-format";
import { useSlowWait } from "../_utils/use-slow-wait";
import { useVisibleWait } from "../generation/use-visible-wait";
import { useLearnAnalytics } from "../learn-context";
import { useReadyHold } from "../wait/use-ready-hold";
import { WaitScreen, WaitSlot, useWaitScreen } from "../wait/wait-screen";
import { AlternativeButton, NotWritten, Waiting } from "./next-stop-wait";
import { SessionFrame } from "./session-frame";
import { SessionHeader } from "./session-header";
import { useSessionQueueAside } from "./session-queue";
import { getSessionQueue } from "./session-queue-rows";
import { type DayStep } from "./session-types";
import { useBlockDetail, useBlockTitle } from "./use-block-copy";
import { useSessionAction } from "./use-session-action";

export type NextStopLesson = "failed" | "notStarted" | "ready" | "writing";

export type NextStopActions = {
  refresh: () => void;
  /** Null when it couldn't be read. */
  readLesson?: (
    lessonId: string,
  ) => Promise<{ generationId: string | null; lesson: NextStopLesson } | null>;
  start: (step: DayStep) => Promise<boolean>;
  stop: () => Promise<boolean>;
};

export type NextStopTap = {
  focus: boolean;
  state: "failed" | "opening";
  /** `Date.now()` of the tap. */
  tappedAt: number;
};

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
    <EnterButton busy={busy} icon={<PlayIcon aria-hidden="true" />} onClick={onClick} ref={ref}>
      {step.status === "active" ? t("Continue") : t("Start")}
    </EnterButton>
  );
}

/**
 * A lesson written while the learner waited is offered, never opened on its own: the learner may be
 * reading, or doing what "While you wait" offered.
 */
function useWrittenWhileWaiting({
  block,
  lesson,
}: {
  block: DayStep;
  lesson: NextStopLesson;
}): boolean {
  const ready = lesson === "ready";
  const [waitedFor, setWaitedFor] = useState(ready ? null : block.position);

  if (!ready && waitedFor !== block.position) {
    setWaitedFor(block.position);
  }

  return ready && waitedFor === block.position;
}

function useStartState({
  actions,
  block,
  isReady,
  tap,
}: {
  actions: NextStopActions;
  block: DayStep;
  isReady: boolean;
  tap: NextStopTap | null;
}) {
  const opening = tap?.state === "opening";

  const start = useSessionAction({
    action: () => actions.start(block),
    enterKey: isReady && !opening,
  });

  const busy = start.isPending || opening;
  const failed = start.failed || (tap?.state === "failed" && !start.isPending && !opening);

  // The tap's wait goes on through what opens the step after it, so its line neither starts over
  // nor blinks when the tap hands over.
  const [tappedAt, setTappedAt] = useState<number>();

  if (opening && tappedAt !== tap.tappedAt) {
    setTappedAt(tap.tappedAt);
  } else if (!busy && tappedAt !== undefined) {
    setTappedAt(undefined);
  }

  const wait = useSlowWait(busy, { since: opening ? tap.tappedAt : tappedAt });

  return { busy, failed, run: start.run, wait };
}

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
  written: boolean;
}) {
  const t = useExtracted();
  const start = useStartState({ actions, block, isReady, tap });
  const stop = useSessionAction({ action: actions.stop });
  const { slotShown } = useWaitScreen();
  const canStop = sessionBar.completed > 0;
  const quizSlot = !isReady && !notWritten && slotShown;

  if (!isReady && !alternative && !canStop && !quizSlot) {
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

      <TaskActions
        className={
          !isReady && (alternative || quizSlot) ? "max-lg:flex-col max-lg:items-stretch" : undefined
        }
      >
        {canStop && (
          <Button
            busy={stop.isPending}
            icon={<CircleStopIcon aria-hidden="true" />}
            onClick={stop.run}
            size="xl"
            variant="outline"
          >
            {t("Stop for today")}
          </Button>
        )}

        {isReady && (
          <StartButton
            busy={start.busy}
            focus={Boolean(tap?.focus) || written}
            onClick={start.run}
            step={block}
          />
        )}

        {quizSlot && <WaitSlot enterKey={!alternative} />}

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
 * The page reads the goal's first lesson's deck only while it waits, so the screen keeps it: a
 * learner who guessed finishes the card after the lesson is written, as on every wait.
 */
function useKeptDeck(deck: WarmUpDeck | null): WarmUpDeck | null {
  const [kept, setKept] = useState(deck);

  if (deck && deck.id !== kept?.id) {
    setKept(deck);
  }

  return kept;
}

export function NextStop({
  goalId,
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
  tap = null,
  warmUp = null,
}: {
  goalId: string;
  actions: NextStopActions;
  alternative: DayStep | null;
  block: DayStep;
  blocks: readonly DayStep[];
  exitHref: string;
  generationId: string | null;
  lesson: NextStopLesson;
  lessonsComing?: boolean;
  notWritten: LessonNotWritten | null;
  sessionBar: { completed: number; total: number };
  tap?: NextStopTap | null;
  warmUp?: WarmUpDeck | null;
}) {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const title = useBlockTitle();
  const detail = useBlockDetail();
  const isReady = lesson === "ready";
  const line = detail(block);
  const queue = getSessionQueue({ blocks, nextPosition: block.position });
  const aside = useSessionQueueAside(queue);

  const written = useWrittenWhileWaiting({ block, lesson });
  const deck = useKeptDeck(warmUp);
  const hold = useReadyHold(isReady);
  const { track } = useLearnAnalytics();
  // A learner who played keeps the finished wait and their card; anyone else sees Start alone.
  const showsWait = !notWritten && (!isReady || (written && hold.status !== "go"));

  useVisibleWait({ contentKind: "lesson", enabled: showsWait, goalId, surface: "nextStop", track });
  const facts = [formatDuration(block.estimatedMinutes), block.oftenTested && t("Often tested")];

  return (
    <WaitScreen
      deck={hold.status === "go" ? null : deck}
      goalId={goalId}
      hold={hold}
      surface="lessonWait"
    >
      <SessionFrame aside={aside}>
        <SessionHeader
          exitHref={exitHref}
          lessonsComing={lessonsComing}
          queue={queue.rows}
          sessionBar={sessionBar}
        />

        <TaskBody data-slot="next-stop">
          <div className="flex flex-col gap-2">
            <PageEyebrow>{t("Up next")}</PageEyebrow>
            <h2 className="text-title">{title(block)}</h2>
            {line && <p className="text-muted-foreground text-sm text-balance">{line}</p>}
            <TaskMeta facts={facts} />
          </div>

          <StatusRegion className="text-sm text-pretty">
            {written && t("Your lesson is ready.")}
          </StatusRegion>

          {!isReady && notWritten && (
            <NotWritten actions={actions} block={block} reason={notWritten} />
          )}

          {showsWait && (
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
          written={written}
        />
      </SessionFrame>
    </WaitScreen>
  );
}
