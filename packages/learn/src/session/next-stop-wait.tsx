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

const WAITING_CHECK_MS = 5000;

const STUCK_AFTER_MS = { notStarted: 20_000, writing: 300_000 } as const;

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
 * readiness contract can't tell a retryable failure from a lesson set aside.
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
