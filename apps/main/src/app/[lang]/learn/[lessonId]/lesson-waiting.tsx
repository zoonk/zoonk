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

const ALTERNATIVE_AFTER_MS = 15_000;

const OPEN_RETRY_MS = 2000;

const LIMIT_ROUTES = { signUp: "/login", upgrade: "/subscription" };

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

function useOpenWhenReady(isReady: boolean) {
  const router = useRouter();
  const locale = useLocale();
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

  const run: GenerationRun =
    writing.request.status === "failed"
      ? { failure: "notStarted", retry: writing.retry, status: "failed", steps: {} }
      : followed;

  useOpenWhenReady(run.status === "ready");

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
  const [starting, setStarting] = useState(false);

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
