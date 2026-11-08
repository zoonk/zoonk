"use client";

import { useSignUpHref } from "@/components/learn/use-sign-up-href";
import { Link, useRouter } from "@/i18n/navigation";
import { type LessonRequest, useLessonWriting } from "@/lib/lessons/use-lesson-writing";
import { useWorkflowRun } from "@/lib/workflow/use-workflow-run";
import { trackEvent } from "@zoonk/core/analytics/client";
import { type WarmUpDeck } from "@zoonk/core/library/warm-ups/contract";
import { type LessonWaitingResult } from "@zoonk/core/lookahead/lesson-waiting-state";
import { GenerationFailureNotice, GenerationWait } from "@zoonk/learn/generation";
import { type GenerationRun, toHeldRun } from "@zoonk/learn/generation/run";
import { useVisibleWait } from "@zoonk/learn/generation/wait-clock";
import { KindMark } from "@zoonk/learn/kind-tile";
import { LessonNotWrittenNotice } from "@zoonk/learn/lesson-not-written";
import { TaskMainButton } from "@zoonk/learn/task-frame";
import { TaskActionBar, TaskActions } from "@zoonk/learn/task-layout";
import { WaitContent, WaitScreen, WaitSlot, useWaitScreen } from "@zoonk/learn/wait";
import { useReadyHold } from "@zoonk/learn/wait/hold";
import { LessonWaitStatus } from "@zoonk/learn/wait/lesson-status";
import { useMountTime } from "@zoonk/ui/hooks/mount-time";
import { ChevronRightIcon, PlayIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useEffect, useEffectEvent, useState } from "react";
import { LessonRouteFrame } from "./lesson-route-frame";

type ReadyAlternative = NonNullable<
  Extract<LessonWaitingResult, { status: "ready" }>["state"]["alternative"]
>;

type LessonOutline = { description: string; estimatedMinutes: number; id: string; title: string };

const ALTERNATIVE_AFTER_MS = 15_000;

const OPEN_RETRY_MS = 2000;

function Alternative({
  alternative,
  instead = false,
}: {
  alternative: ReadyAlternative;
  instead?: boolean;
}) {
  const t = useExtracted();

  const rowClass =
    "bg-muted hover:bg-muted/70 -mx-2.5 flex min-h-11 items-center gap-3 rounded-[0.625rem] px-2.5 py-2.75 text-sm font-medium transition-colors";

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-label">
        {instead
          ? t({
              description:
                "Heading over a lesson or review the learner can start now, because this lesson couldn't be written.",
              message: "Ready to do instead",
            })
          : t("Ready while you wait")}
      </h2>
      {alternative.kind === "lesson" ? (
        <Link className={rowClass} href={`/learn/${alternative.lessonId}`}>
          <KindMark kind="lesson" />
          <span className="min-w-0 flex-1 text-balance">{alternative.title}</span>
          <ChevronRightIcon aria-hidden="true" className="text-muted-foreground size-4 shrink-0" />
        </Link>
      ) : (
        <Link className={rowClass} href="/today">
          <KindMark kind="review" />
          <span className="min-w-0 flex-1">
            {t("{count, plural, one {Review # idea} other {Review # ideas}}", {
              count: alternative.dueSkills,
            })}
          </span>
          <ChevronRightIcon aria-hidden="true" className="text-muted-foreground size-4 shrink-0" />
        </Link>
      )}
    </section>
  );
}

function useIsLate() {
  const [late, setLate] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setLate(true), ALTERNATIVE_AFTER_MS);
    return () => clearTimeout(timer);
  }, []);

  return late;
}

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
  run,
  since,
}: {
  holding: boolean;
  run: GenerationRun;
  since: number;
}) {
  const t = useExtracted();

  return (
    <>
      <GenerationWait
        doneLabel={holding ? t("Your lesson is ready") : undefined}
        kind="lesson"
        run={holding ? toHeldRun(run) : run}
        since={since}
      />

      {run.status !== "failed" && (
        <p className="text-muted-foreground text-sm text-pretty">
          {holding
            ? t("Your lesson is ready. Start it whenever you like.")
            : t("It usually takes a few minutes. The lesson opens here as soon as it's ready.")}
        </p>
      )}
    </>
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
  children,
  footer,
  frame,
  warmUp,
  writing,
}: {
  alternative: ReadyAlternative | null;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  frame: LessonFrame;
  warmUp: WarmUpDeck | null;
  writing: ReturnType<typeof useLessonWriting>;
}) {
  const late = useIsLate();
  const since = useMountTime().getTime();

  const followed = useWorkflowRun({
    generationId: writing.generationId,
    kind: "lesson",
    restart: writing.restart,
  });

  const run: GenerationRun =
    writing.request.status === "failed"
      ? { failure: "notStarted", retry: writing.retry, status: "failed", steps: {} }
      : followed;

  const ready = run.status === "ready";
  const hold = useReadyHold(ready);
  const holding = hold.status === "hold";
  const progress = <WritingProgress holding={holding} run={run} since={since} />;

  useOpenWhenReady(hold.status === "go");

  useVisibleWait({
    contentKind: "lesson",
    goalId: frame.goalId,
    surface: "lessonWait",
    track: trackEvent,
  });

  return (
    <WaitScreen deck={warmUp} goalId={frame.goalId} hold={hold} surface="lessonWait">
      <LessonRouteFrame {...frame} footer={<WritingWaitBar footer={footer} holding={holding} />}>
        {children}

        <WaitContent
          progress={progress}
          status={
            run.status === "failed" ? (
              <GenerationFailureNotice failure={run.failure ?? "generation"} retry={run.retry} />
            ) : (
              <LessonWaitStatus holding={holding} run={run} since={since} />
            )
          }
        />

        {!holding && (late || run.status === "failed") && alternative && (
          <Alternative alternative={alternative} />
        )}
      </LessonRouteFrame>
    </WaitScreen>
  );
}

function UnwrittenLessonNote() {
  const t = useExtracted();

  return (
    <p className="flex flex-col gap-1 text-sm text-pretty">
      <span className="font-medium">{t("This lesson isn't written yet")}</span>
      <span className="text-muted-foreground">
        {t("Zoonk writes it when you start. It takes a few minutes.")}
      </span>
    </p>
  );
}

function StartLessonBar({ busy, onStart }: { busy: boolean; onStart: () => void }) {
  const t = useExtracted();

  return (
    <TaskActionBar>
      <TaskActions>
        <TaskMainButton busy={busy} icon={<PlayIcon aria-hidden="true" />} onClick={onStart}>
          {t("Start this lesson")}
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
  lesson,
  warmUp,
}: {
  goalId: string | null;
  alternative: ReadyAlternative | null;
  exitHref: string;
  initialRequest: LessonRequest;
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
        warmUp={warmUp}
        writing={writing}
      >
        {showsStart && <UnwrittenLessonNote />}
      </WritingWait>
    );
  }

  return (
    <LessonRouteFrame {...frame} footer={footer}>
      {showsStart && <UnwrittenLessonNote />}

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
          {alternative && <Alternative alternative={alternative} instead />}
        </>
      )}
    </LessonRouteFrame>
  );
}
