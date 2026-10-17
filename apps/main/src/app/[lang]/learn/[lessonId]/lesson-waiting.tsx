"use client";

import { Link, useRouter } from "@/i18n/navigation";
import { recordGenerationWaitAction } from "@/lib/lessons/generation-wait-action";
import { type LessonRequest, useLessonWriting } from "@/lib/lessons/use-lesson-writing";
import { useWorkflowRun } from "@/lib/workflow/use-workflow-run";
import { type LessonWaitingResult } from "@zoonk/core/lookahead/lesson-waiting-state";
import { GenerationWait } from "@zoonk/learn/generation";
import { type GenerationRun } from "@zoonk/learn/generation/run";
import { KindMark } from "@zoonk/learn/kind-tile";
import { LessonNotWrittenNotice } from "@zoonk/learn/lesson-not-written";
import { TaskMainButton } from "@zoonk/learn/task-frame";
import { TaskActionBar, TaskActions } from "@zoonk/learn/task-layout";
import { ChevronRightIcon } from "lucide-react";
import { useExtracted, useLocale } from "next-intl";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { LessonRouteFrame } from "./lesson-route-frame";

type ReadyAlternative = NonNullable<
  Extract<LessonWaitingResult, { status: "ready" }>["state"]["alternative"]
>;

type LessonOutline = { description: string; estimatedMinutes: number; id: string; title: string };

/** After this long, a ready alternative is offered so the wait is never the only way forward. */
const ALTERNATIVE_AFTER_MS = 15_000;

/** Once the lesson is written, the page is read again this often until the player shows it. */
const OPEN_RETRY_MS = 2000;

/** Where a refused guest creates an account and a free learner sees Plus. */
const LIMIT_ROUTES = { signUp: "/login", upgrade: "/subscription" };

/**
 * Something ready, as the list's highlighted "next" row: its name and where it leads, one tap away
 * while the lesson is written or in place of one that won't be.
 */
function Alternative({
  alternative,
  instead = false,
}: {
  alternative: ReadyAlternative;
  /** Offered in place of this lesson (it won't be written now), not while it's written. */
  instead?: boolean;
}) {
  const t = useExtracted();

  const rowClass =
    "bg-muted hover:bg-muted/70 -mx-2.5 flex min-h-11 items-center gap-3 rounded-[0.625rem] px-2.5 py-2.75 text-sm font-medium transition-colors";

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-label">
        {instead ? t("Ready to do instead") : t("Ready while you wait")}
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

/**
 * Once written, the page reads itself again and opens the player; the wait (from asking for the
 * lesson) is recorded alongside, so the lesson never waits on analytics. It keeps reading until the
 * player shows, in case one read still finds the lesson being written.
 */
function useOpenWhenReady(isReady: boolean) {
  const router = useRouter();
  const locale = useLocale();
  // When the wait began: set once the page shows, never during a render.
  const startedAt = useRef<number | null>(null);

  const open = useEffectEvent(() => {
    void recordGenerationWaitAction({
      contentKind: "lesson",
      locale,
      milliseconds: Date.now() - (startedAt.current ?? Date.now()),
    });

    router.refresh();
  });

  const readAgain = useEffectEvent(() => router.refresh());

  useEffect(() => {
    startedAt.current ??= Date.now();
  }, []);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    open();
    const timer = setInterval(readAgain, OPEN_RETRY_MS);
    return () => clearInterval(timer);
  }, [isReady]);
}

/**
 * The run writing the lesson, followed live: the shared wait's bar and phases, the lesson opening
 * on its own once it's ready, and a stop (a lost connection, a failed run, a request that didn't
 * go through) said plainly with its way out. A plan's next written lesson is offered after a while
 * or as soon as the wait stops.
 */
function WritingWait({
  alternative,
  writing,
}: {
  alternative: ReadyAlternative | null;
  writing: ReturnType<typeof useLessonWriting>;
}) {
  const t = useExtracted();
  const late = useIsLate();

  const followed = useWorkflowRun({
    generationId: writing.generationId,
    kind: "lesson",
    restart: writing.restart,
  });

  // The request itself didn't go through: nothing started, and asking again starts it.
  const run: GenerationRun =
    writing.request.status === "failed"
      ? { failure: "notStarted", retry: writing.retry, status: "failed", steps: {} }
      : followed;

  useOpenWhenReady(run.status === "ready");

  // The header names the lesson and the frame says what it's about, so the wait is only the wait.
  return (
    <>
      <GenerationWait kind="lesson" run={run} />

      {run.status !== "failed" && (
        <p className="text-muted-foreground text-sm text-pretty">
          {t("It usually takes a minute or two. The lesson opens here as soon as it's ready.")}
        </p>
      )}

      {(late || run.status === "failed") && alternative && (
        <Alternative alternative={alternative} />
      )}
    </>
  );
}

/**
 * Why the lesson isn't here and what starting it does, flat in the column like the notes that take
 * its place (a limit reached, a lesson set aside).
 */
function UnwrittenLessonNote() {
  const t = useExtracted();

  return (
    <p className="flex flex-col gap-1 text-sm text-pretty">
      <span className="font-medium">{t("This lesson isn't written yet")}</span>
      <span className="text-muted-foreground">
        {t("Zoonk writes it when you start. It takes a minute or two.")}
      </span>
    </p>
  );
}

/**
 * "Start this lesson", the direct visitor's one main action, pinned where the lesson's own actions
 * will be: Enter presses it, and it says it's starting while the lesson is asked for.
 */
function StartLessonBar({ busy, onStart }: { busy: boolean; onStart: () => void }) {
  const t = useExtracted();

  return (
    <TaskActionBar>
      <TaskActions>
        <TaskMainButton busy={busy} onClick={onStart}>
          {busy ? t("Starting…") : t("Start this lesson")}
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

/**
 * A lesson that isn't written yet, for someone who can have it written, with the same chrome as
 * the lesson it becomes (leave on the left, its title in the header, what it's about beside it from
 * `lg`): it offers writing from an explicit action or follows writing already requested, opens
 * the lesson once it's ready, and offers something ready
 * if it takes long. Never a spinner with no end.
 */
export function LessonWaiting({
  alternative,
  exitHref,
  initialRequest,
  lesson,
}: {
  alternative: ReadyAlternative | null;
  exitHref: string;
  initialRequest: LessonRequest;
  lesson: LessonOutline;
}) {
  const writing = useLessonWriting({ initialRequest, lessonId: lesson.id });
  const { request } = writing;
  // The visitor pressed Start: its button stays, busy, until the request is answered.
  const [starting, setStarting] = useState(false);

  // Written meanwhile (another run finished it): the page opens it.
  useOpenWhenReady(request.status === "ready");

  const start = () => {
    setStarting(true);
    void writing.start();
  };

  const showsStart = request.status === "idle" || (starting && request.status === "requesting");

  return (
    <LessonRouteFrame
      exitHref={exitHref}
      footer={
        showsStart && <StartLessonBar busy={request.status === "requesting"} onStart={start} />
      }
      lesson={lesson}
    >
      {showsStart && <UnwrittenLessonNote />}
      {isWriting(request) && (
        <WritingWait alternative={alternative} key={writing.attempt} writing={writing} />
      )}

      {(request.status === "refused" ||
        request.status === "plusRequired" ||
        request.status === "setAside") && (
        <>
          <LessonNotWrittenNotice
            className="rounded-none bg-transparent p-0"
            linkComponent={Link}
            onRetry={writing.retry}
            reason={request}
            routes={LIMIT_ROUTES}
          />
          {alternative && <Alternative alternative={alternative} instead />}
        </>
      )}
    </LessonRouteFrame>
  );
}
