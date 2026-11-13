"use client";

import { type WarmUpDeck } from "@zoonk/core/library/warm-ups/contract";
import { Button } from "@zoonk/ui/components/button";
import { CircleStopIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useLayoutEffect, useRef, useState } from "react";
import { EnterButton } from "../_components/enter-button";
import { Eyebrow } from "../_components/eyebrow";
import { type LessonNotWritten } from "../_components/lesson-not-written-notice";
import { OpeningWaitLine } from "../_components/opening-wait-line";
import { ChangeSaveError } from "../_components/save-error";
import { StatusRegion } from "../_components/status-region";
import { TaskActionBar, TaskActions, TaskBody } from "../_components/task-layout";
import { TaskMeta } from "../_components/task-meta";
import { isFocusLost } from "../_utils/is-focus-lost";
import { useFormatDuration } from "../_utils/time-format";
import { useSlowWait } from "../_utils/use-slow-wait";
import { type LessonKind } from "../generation/generation-kinds";
import { useVisibleWait } from "../generation/use-visible-wait";
import { useLearnAnalytics } from "../learn-context";
import { useReadyHold } from "../wait/use-ready-hold";
import { WaitScreen, WaitSlot, useWaitScreen } from "../wait/wait-screen";
import { StopFailed } from "./action-failed";
import {
  AlternativeButton,
  NotWritten,
  Waiting,
  useKeptDeck,
  useWrittenWhileWaiting,
} from "./next-stop-wait";
import { ReviewIntro, noteReviewStart, useReviewLine } from "./review-intro";
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
  ) => Promise<{ generationId: string | null; lesson: NextStopLesson; setAside: boolean } | null>;
  start: (step: DayStep) => Promise<boolean>;
  stop: () => Promise<boolean>;
};

export type NextStopTap = {
  focus: boolean;
  /** `waiting`: the tap only brought the step here, and it starts when the learner taps Start. */
  state: "failed" | "opening" | "waiting";
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
  onStart,
  step,
}: {
  busy: boolean;
  focus: boolean;
  onStart: () => void;
  step: DayStep;
}) {
  const t = useExtracted();
  const ref = useTapFocus(focus);

  return (
    <form action={() => onStart()} className="contents">
      <EnterButton busy={busy} enter="host" ref={ref} type="submit">
        {step.status === "active" ? t("Continue") : t("Start")}
      </EnterButton>
    </form>
  );
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

  const note = (start.failed || stop.failed || start.wait !== "none") && (
    <>
      {start.failed && (
        <ChangeSaveError>{t("We couldn't open this step. Try again.")}</ChangeSaveError>
      )}
      {stop.failed && <StopFailed />}
      <OpeningWaitLine wait={start.wait} />
    </>
  );

  return (
    <TaskActionBar note={note}>
      <TaskActions>
        {canStop && (
          <form action={() => void stop.run()} className="contents">
            <Button
              busy={stop.isPending}
              icon={<CircleStopIcon aria-hidden="true" />}
              size="xl"
              type="submit"
              variant="outline"
            >
              {t("Stop for today")}
            </Button>
          </form>
        )}

        {isReady && (
          <StartButton
            busy={start.busy}
            focus={Boolean(tap?.focus) || written}
            onStart={start.run}
            step={block}
          />
        )}

        {quizSlot && <WaitSlot enterKey={!alternative} />}

        {!isReady && alternative && (
          <AlternativeButton actions={actions} alternative={alternative} />
        )}
      </TaskActions>
    </TaskActionBar>
  );
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
  lessonKind = "lesson",
  lessonsComing = false,
  minutesLeft,
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
  lessonKind?: LessonKind;
  lessonsComing?: boolean;
  minutesLeft: number;
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
  const line = useReviewLine({ block, detail: detail(block), goalId });
  const rows = getSessionQueue({ blocks, nextPosition: block.position });
  const aside = useSessionQueueAside({ left: minutesLeft, rows });

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
          queue={rows}
          sessionBar={sessionBar}
        />

        <TaskBody data-slot="next-stop">
          <div className="flex flex-col gap-2">
            <Eyebrow className="mb-1">{t("Up next")}</Eyebrow>
            <h2 className="text-title">{title(block)}</h2>
            {line && <p className="text-muted-foreground text-sm text-pretty">{line}</p>}
            <TaskMeta facts={facts} />
          </div>

          <ReviewIntro block={block} />

          <StatusRegion className="text-sm text-pretty">
            {written && t("Your lesson is ready.")}
          </StatusRegion>

          {!isReady && notWritten && (
            <NotWritten actions={actions} block={block} reason={notWritten} />
          )}

          {showsWait && (
            <Waiting
              actions={actions}
              block={block}
              generationId={generationId}
              kind={lessonKind}
              lesson={lesson}
            />
          )}
        </TaskBody>

        <NextStopActionBar
          actions={{
            ...actions,
            start: (step) => {
              noteReviewStart({ block: step, goalId });
              return actions.start(step);
            },
          }}
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
