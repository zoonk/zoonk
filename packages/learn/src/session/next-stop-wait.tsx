"use client";

import { type WarmUpDeck } from "@zoonk/core/library/warm-ups/contract";
import { GenerationTimelineDescription } from "@zoonk/ui/components/generation-timeline";
import { useMountTime } from "@zoonk/ui/hooks/mount-time";
import { PlayIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useEffect, useState } from "react";
import { EnterButton } from "../_components/enter-button";
import {
  type LessonNotWritten,
  LessonNotWrittenNotice,
} from "../_components/lesson-not-written-notice";
import { usePoll } from "../_utils/use-poll";
import { FollowedRun } from "../generation/generation-follower";
import { type LessonKind } from "../generation/generation-kinds";
import { type GenerationRun, toHeldRun } from "../generation/generation-run";
import { GenerationFailureNotice, GenerationWait } from "../generation/generation-wait";
import { useLearnRoutes } from "../learn-context";
import { LearnLink } from "../learn-link";
import { LessonWaitStatus } from "../wait/lesson-wait-status";
import { WaitContent } from "../wait/wait-screen";
import { type NextStopActions, type NextStopLesson } from "./next-stop";
import { type DayStep } from "./session-types";
import { useBlockTitle } from "./use-block-copy";
import { useSessionAction } from "./use-session-action";

const WAITING_CHECK_MS = 5000;

// A lesson opens at most five minutes after its text is written, so writing ends well inside this.
const STUCK_AFTER_MS = { notStarted: 20_000, writing: 600_000 } as const;

/** The wait never shows a set-aside lesson: the session read shows its notice instead. */
function hasLessonChanged({
  generationId,
  lesson,
  read,
}: {
  generationId: string | null;
  lesson: NextStopLesson;
  read: { generationId: string | null; lesson: NextStopLesson; setAside: boolean };
}): boolean {
  return (
    read.setAside ||
    read.lesson !== lesson ||
    (read.lesson === "writing" && read.generationId !== generationId)
  );
}

/**
 * Reads the whole session only when the lesson changed. A failed lesson is still checked: after Try
 * again, it stays failed until the new run takes it.
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
    active: lesson !== "ready",
    intervalMs: WAITING_CHECK_MS,
    key: `${lessonId ?? block.position}:${lesson}:${generationId ?? ""}`,
    onPoll: async (signal) => {
      if (!lessonId || !actions.readLesson) {
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

/** A written lesson's page no longer names its run, so its held wait keeps the one it followed. */
function useHeldRunId({ generationId, held }: { generationId: string | null; held: boolean }) {
  const [followed, setFollowed] = useState(generationId);

  if (!held && followed !== generationId) {
    setFollowed(generationId);
  }

  return held ? followed : generationId;
}

function WritingProgress({
  held,
  kind,
  run,
  since,
}: {
  held: boolean;
  kind: LessonKind;
  run: GenerationRun;
  since: number;
}) {
  const t = useExtracted();

  return (
    <GenerationWait kind={kind} run={held ? toHeldRun(run) : run} since={since}>
      {!held && (
        <GenerationTimelineDescription className="text-sm">
          {t("This lesson is being written for you. It's usually ready in a few minutes.")}
        </GenerationTimelineDescription>
      )}
    </GenerationWait>
  );
}

/** The lesson's writing as the wait screen shows it: a strip over the quiz, or its progress. */
export function Waiting({
  actions,
  block,
  generationId,
  kind,
  lesson,
}: {
  actions: NextStopActions;
  block: DayStep;
  generationId: string | null;
  kind: LessonKind;
  lesson: NextStopLesson;
}) {
  const held = lesson === "ready";
  const stuck = useLooksStuck(lesson);
  const runId = useHeldRunId({ generationId, held });
  const since = useMountTime().getTime();

  const poll = useWaitingCheck({ actions, block, generationId, lesson });

  if (lesson === "failed" || stuck) {
    const failure = (
      <GenerationFailureNotice
        failure={lesson === "notStarted" ? "notStarted" : "generation"}
        retry={() => {
          poll.restart();
          void actions.start(block);
        }}
      />
    );

    return <WaitContent progress={failure} status={failure} />;
  }

  return (
    <FollowedRun
      generationId={runId}
      key={runId ?? "notStarted"}
      kind={kind}
      onReady={actions.refresh}
      restart={async () => ((await actions.start(block)) ? undefined : null)}
    >
      {(run) => (
        <WaitContent
          progress={<WritingProgress held={held} kind={kind} run={run} since={since} />}
          status={
            run.status === "failed" ? (
              <GenerationFailureNotice failure={run.failure ?? "generation"} retry={run.retry} />
            ) : (
              <LessonWaitStatus holding={held} kind={kind} run={run} since={since} />
            )
          }
        />
      )}
    </FollowedRun>
  );
}

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
 * The block's name follows a label: inside a sentence, "Do What you already know" read wrong in
 * every language.
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
    <form action={() => void other.run()} className="contents">
      <EnterButton
        busy={other.isPending}
        enter="host"
        icon={<PlayIcon aria-hidden="true" />}
        type="submit"
      >
        {reason === "instead"
          ? t("Instead: {title}", { title: title(alternative) })
          : t("While you wait: {title}", { title: title(alternative) })}
      </EnterButton>
    </form>
  );
}

/**
 * A lesson written while the learner waited is offered, never opened on its own: the learner may be
 * reading, or doing what "While you wait" offered.
 */
export function useWrittenWhileWaiting({
  block,
  lesson,
}: {
  block: DayStep;
  lesson: NextStopLesson;
}): boolean {
  const ready = lesson === "ready";
  const [waitedFor, setWaitedFor] = useState(ready ? null : block.position);

  if (!ready && waitedFor !== block.position) {
    setWaitedFor(block.position);
  }

  return ready && waitedFor === block.position;
}

/**
 * The page reads the goal's first lesson's deck only while it waits, so the screen keeps it: a
 * learner who guessed finishes the card after the lesson is written, as on every wait.
 */
export function useKeptDeck(deck: WarmUpDeck | null): WarmUpDeck | null {
  const [kept, setKept] = useState(deck);

  if (deck && deck.id !== kept?.id) {
    setKept(deck);
  }

  return kept;
}
