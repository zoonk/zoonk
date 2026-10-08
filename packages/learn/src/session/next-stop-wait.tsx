"use client";

import { Button } from "@zoonk/ui/components/button";
import { GenerationTimelineDescription } from "@zoonk/ui/components/generation-timeline";
import { useExtracted } from "next-intl";
import { useEffect, useEffectEvent, useState } from "react";
import {
  type LessonNotWritten,
  LessonNotWrittenNotice,
} from "../_components/lesson-not-written-notice";
import { FollowedRun } from "../generation/generation-follower";
import { GenerationFailureNotice, GenerationWait } from "../generation/generation-wait";
import { useLearnRoutes } from "../learn-context";
import { LearnLink } from "../learn-link";
import { type NextStopActions, type NextStopLesson } from "./next-stop";
import { type StudyBlock } from "./session-types";
import { useBlockTitle } from "./use-block-copy";
import { useSessionAction } from "./use-session-action";

/** A lesson being written is checked again every few seconds, so the wait shows live. */
const WAITING_REFRESH_MS = 5000;

/**
 * How long a wait may look stuck before the learner gets a way to ask again: a lesson no run
 * picked up, and a run that took far longer than lessons take (its drafts included).
 */
const STUCK_AFTER_MS = { notStarted: 20_000, writing: 300_000 } as const;

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
            {t("This lesson is being written for you. It's usually ready in about two minutes.")}
          </GenerationTimelineDescription>
        </GenerationWait>
      )}
    </FollowedRun>
  );
}

export function Waiting({
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
export function NotWritten({
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
