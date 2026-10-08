"use client";

import { Button, buttonVariants } from "@zoonk/ui/components/button";
import { useEscapeClick } from "@zoonk/ui/hooks/keyboard";
import { ClockIcon, FlameIcon, XIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useEffect, useEffectEvent, useRef } from "react";
import { EnterButton } from "../_components/enter-button";
import { FactChip, FactChips } from "../_components/fact-chips";
import { KindTile } from "../_components/kind-tile";
import { type LessonNotWritten } from "../_components/lesson-not-written-notice";
import {
  TaskHeader,
  TaskHeaderBar,
  TaskHeaderSide,
  TaskHeaderTitle,
} from "../_components/task-header";
import { LearnLink } from "../learn-link";
import { getBlockKind } from "./block-kind";
import { NotWritten, Waiting } from "./next-stop-wait";
import { SessionBody } from "./session-body";
import { type StudyBlock } from "./session-types";
import { useBlockDetail, useBlockTitle } from "./use-block-copy";
import { useSessionAction } from "./use-session-action";

/**
 * Where the next stop's lesson stands: `writing` while a run writes it, `notStarted` until the
 * run asked for it picks it up, and `failed` when writing it stopped.
 */
export type NextStopLesson = "failed" | "notStarted" | "ready" | "writing";

export type NextStopActions = {
  /** Records how long the learner waited for a lesson before it opened ("Generation Waited"). */
  recordWait?: (milliseconds: number) => void;
  /** Checks again whether the lesson is ready (the host re-reads the session). */
  refresh: () => void;
  start: (blockId: string) => Promise<boolean>;
  stop: () => Promise<boolean>;
};

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

function NextStopHeader({
  exitHref,
  sessionBar,
}: {
  exitHref: string;
  sessionBar: { completed: number; total: number };
}) {
  const t = useExtracted();
  // Nothing is open yet, so leaving loses nothing: Escape closes, like the lesson player.
  const closeRef = useEscapeClick<HTMLAnchorElement>();

  return (
    <TaskHeader>
      <TaskHeaderBar>
        <TaskHeaderSide align="start">
          <LearnLink
            aria-keyshortcuts="Escape"
            aria-label={t("Back to Today")}
            className={buttonVariants({ size: "icon", variant: "ghost" })}
            href={exitHref}
            prefetch={false}
            ref={closeRef}
          >
            <XIcon aria-hidden="true" />
          </LearnLink>
        </TaskHeaderSide>

        <TaskHeaderTitle
          detail={t("{completed} of {total} done", {
            completed: String(sessionBar.completed),
            total: String(sessionBar.total),
          })}
          title={t("Today's session")}
        />

        <TaskHeaderSide align="end" />
      </TaskHeaderBar>
    </TaskHeader>
  );
}

/**
 * The session's next step when it isn't open yet, as one card (its kind's tile, its name big, what
 * it holds, its minutes): a single Start (or Enter) under it, and
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
    <>
      <NextStopHeader exitHref={exitHref} sessionBar={sessionBar} />

      <SessionBody className="lg:justify-center-safe" data-slot="next-stop">
        <section className="bg-card my-auto flex flex-col items-center gap-4 rounded-3xl border px-6 py-8 text-center shadow-xs sm:px-8 lg:my-0">
          <KindTile kind={getBlockKind(block)} size="lg" />
          <div className="flex flex-col items-center gap-1.5">
            <p className="text-muted-foreground text-sm font-medium">{t("Up next")}</p>
            <h2 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">
              {title(block)}
            </h2>
            {line && <p className="text-muted-foreground text-balance">{line}</p>}
          </div>

          <FactChips className="justify-center">
            <FactChip>
              <ClockIcon aria-hidden="true" />
              {t("{minutes} min", { minutes: String(block.estimatedMinutes) })}
            </FactChip>
            {/* A topic the exam board asks a lot, from past papers. */}
            {block.oftenTested && (
              <FactChip>
                <FlameIcon aria-hidden="true" />
                {t("Often tested")}
              </FactChip>
            )}
          </FactChips>
        </section>

        <div className="flex flex-col gap-3 pt-4">
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
              className="min-h-11 self-center"
              disabled={stop.isPending}
              onClick={stop.run}
              size="lg"
              variant="ghost"
            >
              {t("Stop for today")}
            </Button>
          )}
        </div>
      </SessionBody>
    </>
  );
}
