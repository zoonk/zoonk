"use client";

import { useSignUpHref } from "@/components/learn/use-sign-up-href";
import { Link, useRouter } from "@/i18n/navigation";
import { type LessonRequest, useLessonWriting } from "@/lib/lessons/use-lesson-writing";
import { readLessonReadiness } from "@/lib/session/read-lesson-readiness";
import { useWorkflowRun } from "@/lib/workflow/use-workflow-run";
import { trackEvent } from "@zoonk/core/analytics/client";
import { type WarmUpDeck } from "@zoonk/core/library/warm-ups/contract";
import { type LessonWaitingResult } from "@zoonk/core/lookahead/lesson-waiting-state";
import { GenerationFailureNotice, GenerationWait } from "@zoonk/learn/generation";
import { type LessonKind } from "@zoonk/learn/generation/kinds";
import { useReportStopped } from "@zoonk/learn/generation/report-stopped";
import {
  type GenerationRun,
  UNNAMED_RUN,
  hasStopped,
  toAwaitedRun,
  toHeldRun,
} from "@zoonk/learn/generation/run";
import { useVisibleWait } from "@zoonk/learn/generation/wait-clock";
import { LessonNotWrittenNotice } from "@zoonk/learn/lesson-not-written";
import { useLessonReadiness } from "@zoonk/learn/session/lesson-readiness";
import { type NextStopLesson } from "@zoonk/learn/session/next-stop";
import { TaskMainButton } from "@zoonk/learn/task-frame";
import { TaskActionBar, TaskActions } from "@zoonk/learn/task-layout";
import { WaitContent, WaitScreen, WaitSlot, useWaitScreen } from "@zoonk/learn/wait";
import { useReadyHold } from "@zoonk/learn/wait/hold";
import { LessonWaitStatus } from "@zoonk/learn/wait/lesson-status";
import { useMountTime } from "@zoonk/ui/hooks/mount-time";
import { useExtracted } from "next-intl";
import { useEffect, useEffectEvent, useState } from "react";
import { type ReadyAlternative, ReadyLesson } from "./lesson-ready-alternative";
import { LessonRouteFrame } from "./lesson-route-frame";
import { StartLessonBar, WaitNote, type WaitState, useWaitWords } from "./lesson-wait-note";

type LessonOutline = { description: string; estimatedMinutes: number; id: string; title: string };

type SavedLesson =
  | Extract<LessonWaitingResult, { status: "ready" }>["state"]["status"]
  | null;

const OPEN_RETRY_MS = 2000;

/** The wait is measured until the lesson is ready; it opens once the learner moves on. */
function useOpenWhenReady(open: boolean) {
  const router = useRouter();
  const readAgain = useEffectEvent(() => router.refresh());

  useEffect(() => {
    if (!open) {
      return;
    }

    readAgain();
    const timer = setInterval(readAgain, OPEN_RETRY_MS);
    return () => clearInterval(timer);
  }, [open]);
}

type LessonFrame = { goalId: string | null; exitHref: string; lesson: LessonOutline };

function WritingProgress({
  holding,
  kind,
  run,
  since,
}: {
  holding: boolean;
  kind: LessonKind;
  run: GenerationRun;
  since: number;
}) {
  const words = useWaitWords(kind);

  return (
    <GenerationWait
      doneLabel={holding ? words.ready : undefined}
      kind={kind}
      run={holding ? toHeldRun(run) : run}
      since={since}
    />
  );
}

/** Ready and held, the bar starts the lesson; before that it's the quiz's, or the screen's own. */
function WritingWaitBar({
  footer,
  holding,
  kind,
}: {
  footer?: React.ReactNode;
  holding: boolean;
  kind: LessonKind;
}) {
  const { release, slotShown } = useWaitScreen();

  if (holding) {
    return <StartLessonBar busy={false} kind={kind} onStart={release} ready />;
  }

  if (footer || !slotShown) {
    return footer;
  }

  return (
    <TaskActionBar>
      <TaskActions>
        <WaitSlot />
      </TaskActions>
    </TaskActionBar>
  );
}

type Readiness = ReturnType<typeof useLessonReadiness>;

function WritingWait({
  alternative,
  asked,
  footer,
  frame,
  kind,
  readiness,
  warmUp,
  writing,
}: {
  alternative: ReadyAlternative | null;
  asked: boolean;
  footer?: React.ReactNode;
  frame: LessonFrame;
  kind: LessonKind;
  readiness: Readiness;
  warmUp: WarmUpDeck | null;
  writing: ReturnType<typeof useLessonWriting>;
}) {
  const since = useMountTime().getTime();

  const followed = useWorkflowRun({
    generationId: readiness.generationId,
    kind,
    onInterrupted: readiness.check,
    restart: writing.restart,
  });

  useReportStopped({ onStopped: readiness.runStopped, run: followed });

  const run: GenerationRun =
    readiness.lesson === "failed"
      ? { failure: "generation", retry: writing.retry, status: "failed", steps: {} }
      : toAwaitedRun(readiness.generationId ? followed : UNNAMED_RUN);

  const hold = useReadyHold(run.status === "ready" || readiness.written);
  const holding = hold.status === "hold";
  const progress = <WritingProgress holding={holding} kind={kind} run={run} since={since} />;

  useOpenWhenReady(hold.status === "go");

  useVisibleWait({
    contentKind: "lesson",
    goalId: frame.goalId,
    surface: "lessonWait",
    track: trackEvent,
  });

  const state = waitState({ asked, holding, run });

  if (state === "stopped") {
    return (
      <LessonRouteFrame
        {...frame}
        footer={<RetryBar onRetry={run.retry} />}
        lead={<WaitNote kind={kind} state="stopped" />}
      >
        {alternative && <ReadyLesson alternative={alternative} />}
      </LessonRouteFrame>
    );
  }

  return (
    <WaitScreen deck={warmUp} goalId={frame.goalId} hold={hold} surface="lessonWait">
      <LessonRouteFrame
        {...frame}
        footer={<WritingWaitBar footer={footer} holding={holding} kind={kind} />}
        lead={<WaitNote kind={kind} state={state} />}
      >
        <WaitContent
          progress={progress}
          status={
            run.status === "failed" ? (
              <GenerationFailureNotice failure={run.failure ?? "generation"} retry={run.retry} />
            ) : (
              <LessonWaitStatus holding={holding} kind={kind} run={run} since={since} titled />
            )
          }
        />

        {!holding && alternative && <ReadyLesson alternative={alternative} />}
      </LessonRouteFrame>
    </WaitScreen>
  );
}

function RetryBar({ onRetry }: { onRetry?: () => void }) {
  const t = useExtracted();

  return (
    <TaskActionBar>
      <TaskActions>
        <TaskMainButton onClick={() => onRetry?.()}>{t("Try again")}</TaskMainButton>
      </TaskActions>
    </TaskActionBar>
  );
}

function waitState({
  asked,
  holding,
  run,
}: {
  asked: boolean;
  holding: boolean;
  run: GenerationRun;
}): WaitState {
  if (holding) {
    return "ready";
  }

  if (hasStopped(run)) {
    return "stopped";
  }

  return asked ? "gettingReady" : "notReady";
}

function getWaitedLesson({
  request,
  saved,
}: {
  request: LessonRequest;
  saved: SavedLesson;
}): NextStopLesson | null {
  if (request.status === "writing") {
    return "notStarted";
  }

  if (request.status === "failed" || (request.status === "idle" && saved === "failed")) {
    return "failed";
  }

  return request.status === "idle" && saved === "generating" ? "writing" : null;
}

export function LessonWaiting({
  goalId,
  alternative,
  exitHref,
  initialRequest,
  kind,
  lesson,
  saved,
  warmUp,
}: {
  goalId: string | null;
  alternative: ReadyAlternative | null;
  exitHref: string;
  initialRequest: LessonRequest;
  kind: LessonKind;
  lesson: LessonOutline;
  saved: SavedLesson;
  warmUp: WarmUpDeck | null;
}) {
  const router = useRouter();
  const writing = useLessonWriting({ initialRequest, lessonId: lesson.id });
  const { request } = writing;
  const [starting, setStarting] = useState(false);
  const signUpHref = useSignUpHref();
  const frame = { exitHref, goalId, lesson };
  const waited = getWaitedLesson({ request, saved });

  const readiness = useLessonReadiness({
    actions: { readLesson: readLessonReadiness, refresh: () => router.refresh() },
    // A failed ask is the request's own answer: there's no run for readiness to confirm.
    enabled: waited !== null && request.status !== "failed",
    generationId: writing.generationId,
    lesson: waited ?? "ready",
    lessonId: lesson.id,
  });

  useOpenWhenReady(request.status === "ready");

  const start = () => {
    setStarting(true);
    void writing.start();
  };

  const unclaimed = waited === "writing" && readiness.lesson === "ready" && !readiness.written;
  const awaited = waited !== null && !unclaimed;

  const showsStart =
    (request.status === "idle" && !awaited) || (starting && request.status === "requesting");

  const footer = showsStart && (
    <StartLessonBar busy={request.status === "requesting"} kind={kind} onStart={start} />
  );

  if (request.status === "requesting" || awaited) {
    return (
      <WritingWait
        alternative={alternative}
        footer={footer}
        frame={frame}
        key={writing.attempt}
        asked={!showsStart}
        kind={kind}
        readiness={readiness}
        warmUp={warmUp}
        writing={writing}
      />
    );
  }

  return (
    <LessonRouteFrame
      {...frame}
      footer={footer}
      lead={showsStart && <WaitNote kind={kind} state="notReady" />}
    >
      {showsStart && alternative && <ReadyLesson alternative={alternative} />}

      {(request.status === "refused" || request.status === "setAside") && (
        <>
          <LessonNotWrittenNotice
            className="rounded-none bg-transparent p-0"
            linkComponent={Link}
            onRetry={writing.retry}
            reason={request}
            routes={{ signUp: signUpHref, upgrade: "/subscription" }}
          />
          {alternative && <ReadyLesson alternative={alternative} />}
        </>
      )}
    </LessonRouteFrame>
  );
}
