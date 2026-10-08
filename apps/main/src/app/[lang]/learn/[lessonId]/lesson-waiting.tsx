"use client";

import { Link, useRouter } from "@/i18n/navigation";
import { recordGenerationWaitAction } from "@/lib/lessons/generation-wait-action";
import { type LessonRequest, useLessonWriting } from "@/lib/lessons/use-lesson-writing";
import { useWorkflowRun } from "@/lib/workflow/use-workflow-run";
import { type LessonWaitingResult } from "@zoonk/core/lookahead/lesson-waiting-state";
import { GenerationWait } from "@zoonk/learn/generation";
import { type GenerationRun } from "@zoonk/learn/generation/run";
import { LessonNotWrittenNotice } from "@zoonk/learn/lesson-not-written";
import { Button, buttonVariants } from "@zoonk/ui/components/button";
import {
  GenerationTimelineDescription,
  GenerationTimelineTitle,
} from "@zoonk/ui/components/generation-timeline";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted, useLocale } from "next-intl";
import { useEffect, useEffectEvent, useRef, useState } from "react";

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

function Alternative({
  alternative,
  instead = false,
}: {
  alternative: ReadyAlternative;
  /** Offered in place of this lesson (it won't be written now), not while it's written. */
  instead?: boolean;
}) {
  const t = useExtracted();

  // Sized by its content: a long lesson title wraps inside the pill instead of being cut.
  const linkClass = cn(
    buttonVariants({ variant: "outline" }),
    "h-auto min-h-11 rounded-full px-4 py-2 text-center text-balance whitespace-normal",
  );

  return (
    <div className="bg-muted/60 flex flex-col gap-3 rounded-2xl p-4">
      <p className="text-sm">
        {instead ? t("Something ready to do instead:") : t("Something ready while you wait:")}
      </p>
      {alternative.kind === "lesson" ? (
        <Link className={linkClass} href={`/learn/${alternative.lessonId}`}>
          {alternative.title}
        </Link>
      ) : (
        <Link className={linkClass} href="/today">
          {t("{count, plural, one {Review # idea} other {Review # ideas}}", {
            count: alternative.dueSkills,
          })}
        </Link>
      )}
    </div>
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

/** The lesson's own title and description, above whatever the page shows about it. */
function LessonHeader({ lesson }: { lesson: LessonOutline }) {
  return (
    <header className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold tracking-tight text-balance">{lesson.title}</h1>
      <p className="text-muted-foreground text-pretty">{lesson.description}</p>
    </header>
  );
}

/**
 * The run writing the lesson, followed live: the shared wait's bar and phases, the lesson opening
 * on its own once it's ready, and a stop (a lost connection, a failed run, a request that didn't
 * go through) said plainly with its way out. A plan's next written lesson is offered after a while
 * or as soon as the wait stops.
 */
function WritingWait({
  alternative,
  lesson,
  writing,
}: {
  alternative: ReadyAlternative | null;
  lesson: LessonOutline;
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

  return (
    <>
      <GenerationWait kind="lesson" run={run}>
        <GenerationTimelineTitle>{lesson.title}</GenerationTimelineTitle>
        <GenerationTimelineDescription>{lesson.description}</GenerationTimelineDescription>
      </GenerationWait>

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

function isWriting(request: LessonRequest): boolean {
  return (
    request.status === "requesting" || request.status === "writing" || request.status === "failed"
  );
}

/**
 * A lesson that isn't written yet, for someone who can have it written: it asks for it (on open
 * with a session, after "Start this lesson" for a visitor), follows the writing live, opens the
 * lesson once it's ready, and offers something ready if it takes long. Never a spinner with no end.
 */
export function LessonWaiting({
  alternative,
  exitHref,
  hasSession,
  lesson,
}: {
  alternative: ReadyAlternative | null;
  exitHref: "/" | "/today";
  hasSession: boolean;
  lesson: LessonOutline;
}) {
  const t = useExtracted();
  const writing = useLessonWriting({ hasSession, lessonId: lesson.id });
  const { request } = writing;

  // Written meanwhile (another run finished it): the page opens it.
  useOpenWhenReady(request.status === "ready");

  return (
    <main className="bg-background flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="flex w-full max-w-md flex-col gap-6">
        {isWriting(request) ? (
          <WritingWait
            alternative={alternative}
            key={writing.attempt}
            lesson={lesson}
            writing={writing}
          />
        ) : (
          <LessonHeader lesson={lesson} />
        )}

        {request.status === "idle" && (
          <Button className="h-11 w-fit rounded-full" onClick={writing.start}>
            {t("Start this lesson")}
          </Button>
        )}

        {(request.status === "refused" || request.status === "setAside") && (
          <>
            <LessonNotWrittenNotice
              linkComponent={Link}
              onRetry={writing.retry}
              reason={request}
              routes={LIMIT_ROUTES}
            />
            {alternative && <Alternative alternative={alternative} instead />}
          </>
        )}

        <Link className={cn(buttonVariants({ variant: "ghost" }), "w-fit")} href={exitHref}>
          {t("Back")}
        </Link>
      </div>
    </main>
  );
}
