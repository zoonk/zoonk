"use client";

import { Button } from "@zoonk/ui/components/button";
import { useExtracted } from "next-intl";
import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from "react";
import { EnterButton } from "../_components/enter-button";
import { type LessonNotWritten } from "../_components/lesson-not-written-notice";
import { OpeningWaitLine } from "../_components/opening-wait-line";
import { PageEyebrow } from "../_components/page";
import { TaskActionBar, TaskActions, TaskBody } from "../_components/task-layout";
import { TaskMeta } from "../_components/task-meta";
import { isFocusLost } from "../_utils/is-focus-lost";
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

export type NextStopLesson = "failed" | "notStarted" | "ready" | "writing";

export type NextStopActions = {
  recordWait?: (milliseconds: number) => void;
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
 * A lesson written while the learner waited is offered, never opened on its own: the learner may be
 * reading, or doing what "While you wait" offered.
 */
function useWrittenWhileWaiting({
  actions,
  lesson,
}: {
  actions: NextStopActions;
  lesson: NextStopLesson;
}): boolean {
  const [waited, setWaited] = useState(lesson !== "ready");
  const waitedSince = useRef<number | null>(null);
  const record = useEffectEvent((since: number) => actions.recordWait?.(Date.now() - since));

  if (lesson !== "ready" && !waited) {
    setWaited(true);
  }

  useEffect(() => {
    if (lesson !== "ready") {
      waitedSince.current ??= Date.now();
      return;
    }

    const since = waitedSince.current;

    if (since !== null) {
      waitedSince.current = null;
      record(since);
    }
  }, [lesson]);

  return waited && lesson === "ready";
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

      <TaskActions
        className={!isReady && alternative ? "max-lg:flex-col max-lg:items-stretch" : undefined}
      >
        {canStop && (
          <Button disabled={stop.isPending} onClick={stop.run} size="xl" variant="outline">
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
  tap = null,
}: {
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
}) {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const title = useBlockTitle();
  const detail = useBlockDetail();
  const isReady = lesson === "ready";
  const line = detail(block);
  const queue = getSessionQueue({ blocks, nextPosition: block.position });
  const aside = useSessionQueueAside(queue);

  const written = useWrittenWhileWaiting({ actions, lesson });
  const facts = [formatDuration(block.estimatedMinutes), block.oftenTested && t("Often tested")];

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
          <PageEyebrow>{t("Up next")}</PageEyebrow>
          <h2 className="text-title">{title(block)}</h2>
          {line && <p className="text-muted-foreground text-sm text-balance">{line}</p>}
          <TaskMeta facts={facts} />
        </div>

        {/* Empty, it stays in the page, so it's heard when it speaks. */}
        <p className="text-sm text-pretty empty:sr-only" role="status">
          {written && t("Your lesson is ready.")}
        </p>

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
        written={written}
      />
    </SessionFrame>
  );
}
