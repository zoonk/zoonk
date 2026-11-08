"use client";

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
 * Reads the whole session only when the lesson changed; a failed wait always does, since the
 * session read is what shows a set-aside lesson's notice.
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
  run,
  since,
}: {
  held: boolean;
  run: GenerationRun;
  since: number;
}) {
  const t = useExtracted();

  return (
    <GenerationWait kind="lesson" run={held ? toHeldRun(run) : run} since={since}>
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
  lesson,
}: {
  actions: NextStopActions;
  block: DayStep;
  generationId: string | null;
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
      kind="lesson"
      onReady={actions.refresh}
      restart={async () => ((await actions.start(block)) ? undefined : null)}
    >
      {(run) => (
        <WaitContent
          progress={<WritingProgress held={held} run={run} since={since} />}
          status={
            run.status === "failed" ? (
              <GenerationFailureNotice failure={run.failure ?? "generation"} retry={run.retry} />
            ) : (
              <LessonWaitStatus holding={held} run={run} since={since} />
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
    <EnterButton busy={other.isPending} icon={<PlayIcon aria-hidden="true" />} onClick={other.run}>
      {reason === "instead"
        ? t("Instead: {title}", { title: title(alternative) })
        : t("While you wait: {title}", { title: title(alternative) })}
    </EnterButton>
  );
}
