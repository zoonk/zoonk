"use client";

import { GenerationTimelineDescription } from "@zoonk/ui/components/generation-timeline";
import { useExtracted } from "next-intl";
import { useEffect, useState } from "react";
import { EnterButton } from "../_components/enter-button";
import {
  type LessonNotWritten,
  LessonNotWrittenNotice,
} from "../_components/lesson-not-written-notice";
import { usePoll } from "../_utils/use-poll";
import { FollowedRun } from "../generation/generation-follower";
import { GenerationFailureNotice, GenerationWait } from "../generation/generation-wait";
import { useLearnRoutes } from "../learn-context";
import { LearnLink } from "../learn-link";
import { type NextStopActions, type NextStopLesson } from "./next-stop";
import { type DayStep } from "./session-types";
import { useBlockTitle } from "./use-block-copy";
import { useSessionAction } from "./use-session-action";

/**
 * A lesson being written is checked every few seconds, so a run picking it up, another run writing
 * it, or writing that stopped shows without the learner refreshing.
 */
const WAITING_CHECK_MS = 5000;

/**
 * How long a wait may look stuck before the learner gets a way to ask again: a lesson no run
 * picked up, and a run that took far longer than lessons take (its drafts included).
 */
const STUCK_AFTER_MS = { notStarted: 20_000, writing: 300_000 } as const;

/** The lesson's state read now differs from the wait's: another state, or another run writing it. */
function hasLessonChanged({
  generationId,
  lesson,
  read,
}: {
  generationId: string | null;
  lesson: NextStopLesson;
  read: { generationId: string | null; lesson: NextStopLesson };
}): boolean {
  return (
    read.lesson !== lesson || (read.lesson === "writing" && read.generationId !== generationId)
  );
}

/**
 * Checks the waited-for lesson on its own (`readLesson`) and reads the whole session again only
 * when it changed from what the screen shows. Failed waits still read the session: the readiness
 * contract doesn't distinguish a retryable failure from a lesson permanently set aside/skipped.
 * A host without that read, or a step without a lesson, also reads the session every time.
 */
function useWaitingCheck({
  actions,
  block,
  generationId,
  lesson,
}: {
  actions: NextStopActions;
  block: DayStep;
  generationId: string | null;
  lesson: NextStopLesson;
}) {
  const lessonId = block.kind === "learn" ? block.lessonId : null;

  return usePoll({
    active: true,
    intervalMs: WAITING_CHECK_MS,
    key: `${lessonId ?? block.position}:${lesson}:${generationId ?? ""}`,
    onPoll: async (signal) => {
      if (lesson === "failed" || !lessonId || !actions.readLesson) {
        actions.refresh();
        return;
      }

      const read = await actions.readLesson(lessonId);

      if (!signal.aborted && read && hasLessonChanged({ generationId, lesson, read })) {
        actions.refresh();
      }
    },
    startNow: false,
  });
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
  block: DayStep;
  generationId: string | null;
}) {
  const t = useExtracted();

  return (
    <FollowedRun
      generationId={generationId}
      key={generationId ?? "notStarted"}
      kind="lesson"
      onReady={actions.refresh}
      restart={async () => ((await actions.start(block)) ? undefined : null)}
    >
      {(run) => (
        <GenerationWait kind="lesson" run={run}>
          <GenerationTimelineDescription className="text-sm">
            {t("This lesson is being written for you. It's usually ready in about two minutes.")}
          </GenerationTimelineDescription>
        </GenerationWait>
      )}
    </FollowedRun>
  );
}

/**
 * The lesson being written, followed live; checked every few seconds so the wait shows live, with
 * a way to ask again when writing stopped or looks stuck.
 */
export function Waiting({
  actions,
  block,
  generationId,
  lesson,
}: {
  actions: NextStopActions;
  block: DayStep;
  generationId: string | null;
  lesson: NextStopLesson;
}) {
  const stuck = useLooksStuck(lesson);

  const poll = useWaitingCheck({ actions, block, generationId, lesson });

  return (
    <div className="flex flex-col gap-5">
      {/* Writing stopped, or looks stuck: asking again opens the block, which asks for the lesson
          once more, and a run that stopped is replaced. */}
      {lesson === "failed" || stuck ? (
        <GenerationFailureNotice
          failure={lesson === "notStarted" ? "notStarted" : "generation"}
          retry={() => {
            poll.restart();
            void actions.start(block);
          }}
        />
      ) : (
        <WritingProgress actions={actions} block={block} generationId={generationId} />
      )}
    </div>
  );
}

/**
 * The lesson won't be written now: why, with its one thing to do, in the wait's place. Nothing
 * polls: only the learner's next tap can change it.
 */
export function NotWritten({
  actions,
  block,
  reason,
}: {
  actions: NextStopActions;
  block: DayStep;
  reason: LessonNotWritten;
}) {
  const routes = useLearnRoutes();

  return (
    <LessonNotWrittenNotice
      linkComponent={LearnLink}
      onRetry={() => void actions.start(block)}
      reason={reason}
      routes={routes}
    />
  );
}

/**
 * A ready block to do while the lesson is written ("While you wait: Mixed practice") or instead of
 * one that won't be written now ("Instead: …"): the screen's next step, so it's the main action and
 * Enter starts it. The block's name follows a label: inside a sentence, "Do What you already know"
 * read wrong in every language.
 */
export function AlternativeButton({
  actions,
  alternative,
  reason,
}: {
  actions: NextStopActions;
  alternative: DayStep;
  reason: "instead" | "whileWaiting";
}) {
  const t = useExtracted();
  const title = useBlockTitle();

  const other = useSessionAction({ action: () => actions.start(alternative), enterKey: true });

  return (
    <EnterButton
      className="h-auto min-h-11 py-2 text-balance whitespace-normal"
      disabled={other.isPending}
      onClick={other.run}
    >
      {reason === "instead"
        ? t("Instead: {title}", { title: title(alternative) })
        : t("While you wait: {title}", { title: title(alternative) })}
    </EnterButton>
  );
}
