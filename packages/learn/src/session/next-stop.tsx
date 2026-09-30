"use client";

import { Button, buttonVariants } from "@zoonk/ui/components/button";
import { GenerationTimelineDescription } from "@zoonk/ui/components/generation-timeline";
import { cn } from "@zoonk/ui/lib/utils";
import { XIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { EnterButton } from "../_components/enter-button";
import {
  type LessonNotWritten,
  LessonNotWrittenNotice,
} from "../_components/lesson-not-written-notice";
import { FollowedRun } from "../generation/generation-follower";
import { GenerationFailureNotice, GenerationWait } from "../generation/generation-wait";
import { useLearnRoutes } from "../learn-context";
import { LearnLink } from "../learn-link";
import { OftenTestedTag } from "./often-tested-tag";
import { SessionBar } from "./session-bar";
import { type StudyBlock } from "./session-types";
import { useBlockDetail, useBlockTitle } from "./use-block-copy";
import { useSessionAction } from "./use-session-action";

/** A lesson being written is checked again every few seconds, so the wait shows live. */
const WAITING_REFRESH_MS = 5000;

/**
 * How long a wait may look stuck before the learner gets a way to ask again: a lesson no run
 * picked up, and a run that took far longer than lessons take (its drafts included).
 */
const STUCK_AFTER_MS = { notStarted: 20_000, writing: 300_000 } as const;

/**
 * Where the next stop's lesson stands: `writing` while a run writes it, `notStarted` until the
 * run asked for it picks it up, and `failed` when writing it stopped.
 */
export type NextStopLesson = "failed" | "notStarted" | "ready" | "writing";

type NextStopActions = {
  /** Records how long the learner waited for a lesson before it opened ("Generation Waited"). */
  recordWait?: (milliseconds: number) => void;
  /** Checks again whether the lesson is ready (the host re-reads the session). */
  refresh: () => void;
  start: (blockId: string) => Promise<boolean>;
  stop: () => Promise<boolean>;
};

function useWaitingRefresh({ enabled, refresh }: { enabled: boolean; refresh: () => void }) {
  const onTick = useEffectEvent(refresh);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const timer = setInterval(onTick, WAITING_REFRESH_MS);
    return () => clearInterval(timer);
  }, [enabled]);
}

function StartButton({ actions, block }: { actions: NextStopActions; block: StudyBlock }) {
  const t = useExtracted();
  const start = useSessionAction({ action: () => actions.start(block.id), enterKey: true });

  return (
    <>
      <EnterButton disabled={start.isPending} onClick={start.run}>
        {block.status === "active" ? t("Continue") : t("Start")}
      </EnterButton>

      {start.failed && (
        <p className="text-destructive text-center text-sm" role="alert">
          {t("We couldn't open this step. Try again.")}
        </p>
      )}
    </>
  );
}

/**
 * Once the lesson the learner waited for is written, it opens on its own: they already asked for
 * it. A lesson that was ready when the screen opened waits for their Start.
 */
function useOpenWhenWritten({
  actions,
  block,
  lesson,
}: {
  actions: NextStopActions;
  block: StudyBlock;
  lesson: NextStopLesson;
}) {
  // When the wait began, or null while nothing is being waited for.
  const waitedSince = useRef<number | null>(null);

  const onWritten = useEffectEvent((since: number) => {
    actions.recordWait?.(Date.now() - since);
    void actions.start(block.id);
  });

  useEffect(() => {
    if (lesson !== "ready") {
      waitedSince.current ??= Date.now();
      return;
    }

    const since = waitedSince.current;

    if (since !== null) {
      waitedSince.current = null;
      onWritten(since);
    }
  }, [lesson]);
}

/** A wait that looks stuck gets the same way to ask again as writing that stopped. */
function useLooksStuck(lesson: NextStopLesson) {
  const [stuckWhile, setStuckWhile] = useState<NextStopLesson | null>(null);

  useEffect(() => {
    if (lesson !== "notStarted" && lesson !== "writing") {
      return;
    }

    const timer = setTimeout(() => setStuckWhile(lesson), STUCK_AFTER_MS[lesson]);
    return () => clearTimeout(timer);
  }, [lesson]);

  return stuckWhile === lesson;
}

/**
 * The run writing the lesson, followed live with the shared wait (its bar and phases). Once the
 * run says the lesson is ready, the screen reads the session again, which opens it; a run that
 * fails or a lost connection says so with its way out. A new run (after asking again) gets a
 * fresh wait.
 */
function WritingProgress({
  actions,
  block,
  generationId,
}: {
  actions: NextStopActions;
  block: StudyBlock;
  generationId: string | null;
}) {
  const t = useExtracted();

  return (
    <FollowedRun
      generationId={generationId}
      key={generationId ?? "notStarted"}
      kind="lesson"
      onReady={actions.refresh}
      restart={async () => ((await actions.start(block.id)) ? undefined : null)}
    >
      {(run) => (
        <GenerationWait kind="lesson" run={run}>
          <GenerationTimelineDescription className="text-sm">
            {t("This lesson is being written for you. It's usually ready in a minute or two.")}
          </GenerationTimelineDescription>
        </GenerationWait>
      )}
    </FollowedRun>
  );
}

function Waiting({
  actions,
  alternative,
  block,
  generationId,
  lesson,
}: {
  actions: NextStopActions;
  alternative: StudyBlock | null;
  block: StudyBlock;
  generationId: string | null;
  lesson: NextStopLesson;
}) {
  const t = useExtracted();
  const title = useBlockTitle();
  const stuck = useLooksStuck(lesson);

  // While the lesson is written, the ready block is the next step, so Enter starts it.
  const other = useSessionAction({
    action: () => (alternative ? actions.start(alternative.id) : Promise.resolve(false)),
    enterKey: alternative !== null,
  });

  useWaitingRefresh({ enabled: true, refresh: actions.refresh });

  return (
    <div className="flex flex-col gap-5">
      {/* Writing stopped, or looks stuck: asking again opens the block, which asks for the lesson
          once more, and a run that stopped is replaced. */}
      {lesson === "failed" || stuck ? (
        <GenerationFailureNotice
          failure={lesson === "notStarted" ? "notStarted" : "generation"}
          retry={() => void actions.start(block.id)}
        />
      ) : (
        <WritingProgress actions={actions} block={block} generationId={generationId} />
      )}

      {alternative && (
        <Button
          className="h-auto min-h-12 w-full rounded-full py-2 text-base text-balance whitespace-normal"
          disabled={other.isPending}
          onClick={other.run}
          size="lg"
          variant="outline"
        >
          {t("Do {title} while you wait", { title: title(alternative) })}
        </Button>
      )}
    </div>
  );
}

/**
 * The lesson won't be written now: why, with its one thing to do, in the wait's place, and a ready
 * block to do instead. Nothing polls: only the learner's next tap can change it.
 */
function NotWritten({
  actions,
  alternative,
  block,
  reason,
}: {
  actions: NextStopActions;
  alternative: StudyBlock | null;
  block: StudyBlock;
  reason: LessonNotWritten;
}) {
  const t = useExtracted();
  const title = useBlockTitle();
  const routes = useLearnRoutes();

  // With nothing to wait for, the ready block is the next step, so Enter starts it.
  const other = useSessionAction({
    action: () => (alternative ? actions.start(alternative.id) : Promise.resolve(false)),
    enterKey: alternative !== null,
  });

  return (
    <div className="flex flex-col gap-5">
      <LessonNotWrittenNotice
        linkComponent={LearnLink}
        onRetry={() => void actions.start(block.id)}
        reason={reason}
        routes={routes}
      />

      {alternative && (
        <Button
          className="h-auto min-h-12 w-full rounded-full py-2 text-base text-balance whitespace-normal"
          disabled={other.isPending}
          onClick={other.run}
          size="lg"
          variant="outline"
        >
          {t("Do {title} instead", { title: title(alternative) })}
        </Button>
      )}
    </div>
  );
}

/**
 * The session's next stop when it isn't open yet: what it is, a single Start (or Enter), and
 * "Stop for today" between blocks. A lesson still being written never leaves a dead end: the wait
 * updates live, a ready block can come first, the lesson opens on its own once written, and
 * writing that stopped can be asked for again. A lesson that won't be written now (a limit, or set
 * aside) says why instead of waiting, with a ready block to do instead.
 */
export function NextStop({
  actions,
  alternative,
  block,
  exitHref,
  generationId,
  lesson,
  notWritten,
  sessionBar,
}: {
  actions: NextStopActions;
  /** A ready block the learner can do while a lesson is written. */
  alternative: StudyBlock | null;
  block: StudyBlock;
  exitHref: string;
  /** The run writing the block's lesson, when one does: the wait follows its progress. */
  generationId: string | null;
  /** Where the block's lesson stands; `ready` for blocks without one. */
  lesson: NextStopLesson;
  /** Why the block's lesson won't be written now, when the learner's request was turned down. */
  notWritten: LessonNotWritten | null;
  sessionBar: { completed: number; total: number };
}) {
  const t = useExtracted();
  const title = useBlockTitle();
  const detail = useBlockDetail();
  const stop = useSessionAction({ action: actions.stop });
  const line = detail(block);

  useOpenWhenWritten({ actions, block, lesson });

  return (
    <div className="flex flex-1 flex-col gap-6" data-slot="next-stop">
      <header className="flex flex-col gap-3">
        <LearnLink
          aria-label={t("Back to Today")}
          className={cn(buttonVariants({ size: "icon-lg", variant: "ghost" }), "rounded-full")}
          href={exitHref}
          prefetch={false}
        >
          <XIcon aria-hidden="true" />
        </LearnLink>
        <SessionBar completed={sessionBar.completed} total={sessionBar.total} />
      </header>

      <section className="flex flex-col gap-2">
        <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
          {t("Next stop")}
        </p>
        <h1 className="in-data-[mode=fun]:font-fun-display text-3xl font-semibold tracking-tight">
          {title(block)}
        </h1>
        {line && <p className="text-muted-foreground">{line}</p>}
        <p className="text-muted-foreground text-sm tabular-nums">
          {t("{minutes} min", { minutes: String(block.estimatedMinutes) })}
        </p>
        <OftenTestedTag show={block.oftenTested} />
      </section>

      <div className="mt-auto flex flex-col gap-3">
        {lesson === "ready" && <StartButton actions={actions} block={block} />}

        {lesson !== "ready" && notWritten && (
          <NotWritten
            actions={actions}
            alternative={alternative}
            block={block}
            reason={notWritten}
          />
        )}

        {lesson !== "ready" && !notWritten && (
          <Waiting
            actions={actions}
            alternative={alternative}
            block={block}
            generationId={generationId}
            lesson={lesson}
          />
        )}

        {sessionBar.completed > 0 && (
          <Button
            className="self-center"
            disabled={stop.isPending}
            onClick={stop.run}
            size="sm"
            variant="ghost"
          >
            {t("Stop for today")}
          </Button>
        )}
      </div>
    </div>
  );
}
