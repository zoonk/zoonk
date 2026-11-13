"use client";

import { useSignUpHref } from "@/components/learn/use-sign-up-href";
import { Link, useRouter } from "@/i18n/navigation";
import { type LessonRequest, useLessonWriting } from "@/lib/lessons/use-lesson-writing";
import { useWorkflowRun } from "@/lib/workflow/use-workflow-run";
import { trackEvent } from "@zoonk/core/analytics/client";
import { type WarmUpDeck } from "@zoonk/core/library/warm-ups/contract";
import { GenerationFailureNotice, GenerationWait } from "@zoonk/learn/generation";
import { type LessonKind } from "@zoonk/learn/generation/kinds";
import { type GenerationRun, toHeldRun } from "@zoonk/learn/generation/run";
import { useVisibleWait } from "@zoonk/learn/generation/wait-clock";
import { LessonNotWrittenNotice } from "@zoonk/learn/lesson-not-written";
import { TaskMainButton } from "@zoonk/learn/task-frame";
import { TaskActionBar, TaskActions } from "@zoonk/learn/task-layout";
import { WaitContent, WaitScreen, WaitSlot, useWaitScreen } from "@zoonk/learn/wait";
import { useReadyHold } from "@zoonk/learn/wait/hold";
import { LessonWaitStatus } from "@zoonk/learn/wait/lesson-status";
import { useMountTime } from "@zoonk/ui/hooks/mount-time";
import { PlayIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useEffect, useEffectEvent, useState } from "react";
import { type ReadyAlternative, ReadyLesson } from "./lesson-ready-alternative";
import { LessonRouteFrame } from "./lesson-route-frame";

type LessonOutline = { description: string; estimatedMinutes: number; id: string; title: string };

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
  const t = useExtracted();

  return (
    <GenerationWait
      doneLabel={holding ? t("Your lesson is ready") : undefined}
      kind={kind}
      run={holding ? toHeldRun(run) : run}
      since={since}
    />
  );
}

/** Ready and held, the bar starts the lesson; before that it's the quiz's, or the screen's own. */
function WritingWaitBar({ footer, holding }: { footer?: React.ReactNode; holding: boolean }) {
  const { release, slotShown } = useWaitScreen();

  if (holding) {
    return <StartLessonBar busy={false} onStart={release} />;
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

function WritingWait({
  alternative,
  asked,
  footer,
  frame,
  kind,
  warmUp,
  writing,
}: {
  alternative: ReadyAlternative | null;
  asked: boolean;
  footer?: React.ReactNode;
  frame: LessonFrame;
  kind: LessonKind;
  warmUp: WarmUpDeck | null;
  writing: ReturnType<typeof useLessonWriting>;
}) {
  const since = useMountTime().getTime();

  const followed = useWorkflowRun({
    generationId: writing.generationId,
    kind,
    restart: writing.restart,
  });

  const run: GenerationRun =
    writing.request.status === "failed"
      ? { failure: "notStarted", retry: writing.retry, status: "failed", steps: {} }
      : followed;

  const ready = run.status === "ready";
  const hold = useReadyHold(ready);
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
        lead={<WaitNote state="stopped" />}
      >
        {alternative && <ReadyLesson alternative={alternative} />}
      </LessonRouteFrame>
    );
  }

  return (
    <WaitScreen deck={warmUp} goalId={frame.goalId} hold={hold} surface="lessonWait">
      <LessonRouteFrame
        {...frame}
        footer={<WritingWaitBar footer={footer} holding={holding} />}
        lead={<WaitNote state={state} />}
      >
        <WaitContent
          progress={progress}
          status={
            run.status === "failed" ? (
              <GenerationFailureNotice failure={run.failure ?? "generation"} retry={run.retry} />
            ) : (
              <LessonWaitStatus holding={holding} kind={kind} run={run} since={since} />
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

type WaitState = "notReady" | "gettingReady" | "ready" | "stopped";

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

  if (run.status === "failed" && run.failure !== "connection") {
    return "stopped";
  }

  return asked ? "gettingReady" : "notReady";
}

function WaitNote({ state }: { state: WaitState }) {
  const t = useExtracted();

  const title = {
    gettingReady: t("Getting your lesson ready"),
    notReady: t("This lesson isn't ready yet"),
    ready: t("Your lesson is ready"),
    stopped: t("We couldn't get this lesson ready"),
  }[state];

  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-title">{title}</h1>
      {(state === "notReady" || state === "gettingReady") && (
        <p className="text-muted-foreground text-base leading-relaxed text-pretty">
          {t("It takes a few minutes, and keeps going if you leave.")}
        </p>
      )}
    </div>
  );
}

function StartLessonBar({ busy, onStart }: { busy: boolean; onStart: () => void }) {
  const t = useExtracted();

  return (
    <TaskActionBar>
      <TaskActions>
        <TaskMainButton busy={busy} icon={<PlayIcon aria-hidden="true" />} onClick={onStart}>
          {t("Get it ready")}
        </TaskMainButton>
      </TaskActions>
    </TaskActionBar>
  );
}

function isWriting(request: LessonRequest): boolean {
  return (
    request.status === "requesting" || request.status === "writing" || request.status === "failed"
  );
}

export function LessonWaiting({
  goalId,
  alternative,
  exitHref,
  initialRequest,
  kind,
  lesson,
  warmUp,
}: {
  goalId: string | null;
  alternative: ReadyAlternative | null;
  exitHref: string;
  initialRequest: LessonRequest;
  kind: LessonKind;
  lesson: LessonOutline;
  warmUp: WarmUpDeck | null;
}) {
  const writing = useLessonWriting({ initialRequest, lessonId: lesson.id });
  const { request } = writing;
  const [starting, setStarting] = useState(false);
  const signUpHref = useSignUpHref();
  const frame = { exitHref, goalId, lesson };

  useOpenWhenReady(request.status === "ready");

  const start = () => {
    setStarting(true);
    void writing.start();
  };

  const showsStart = request.status === "idle" || (starting && request.status === "requesting");

  const footer = showsStart && (
    <StartLessonBar busy={request.status === "requesting"} onStart={start} />
  );

  if (isWriting(request)) {
    return (
      <WritingWait
        alternative={alternative}
        footer={footer}
        frame={frame}
        key={writing.attempt}
        asked={!showsStart}
        kind={kind}
        warmUp={warmUp}
        writing={writing}
      />
    );
  }

  return (
    <LessonRouteFrame {...frame} footer={footer} lead={showsStart && <WaitNote state="notReady" />}>
      {showsStart && alternative && <ReadyLesson alternative={alternative} />}

      {(request.status === "refused" ||
        request.status === "plusRequired" ||
        request.status === "setAside") && (
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
