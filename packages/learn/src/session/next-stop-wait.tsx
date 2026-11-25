"use client";

import { type WarmUpDeck } from "@zoonk/core/library/warm-ups/contract";
import { GenerationTimelineDescription } from "@zoonk/ui/components/generation-timeline";
import { useMountTime } from "@zoonk/ui/hooks/mount-time";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { EnterButton } from "../_components/enter-button";
import {
  type LessonNotWritten,
  LessonNotWrittenNotice,
} from "../_components/lesson-not-written-notice";
import { FollowedRun } from "../generation/generation-follower";
import { type LessonKind } from "../generation/generation-kinds";
import {
  type GenerationRun,
  UNNAMED_RUN,
  toAwaitedRun,
  toHeldRun,
} from "../generation/generation-run";
import { GenerationFailureNotice, GenerationWait } from "../generation/generation-wait";
import { useReportStopped } from "../generation/use-report-stopped";
import { useLearnRoutes } from "../learn-context";
import { LearnLink } from "../learn-link";
import { LessonWaitStatus } from "../wait/lesson-wait-status";
import { WaitContent } from "../wait/wait-screen";
import { type NextStopActions, type NextStopLesson } from "./next-stop";
import { type DayStep } from "./session-types";
import { useBlockTitle } from "./use-block-copy";
import { useSessionAction } from "./use-session-action";

/** A run is followed inside a render callback, so the report is a component of its own. */
function ReportStopped(props: { onStopped: () => void; run: GenerationRun }) {
  useReportStopped(props);
  return null;
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
  barHasMainAction,
  held,
  kind,
  run,
  since,
}: {
  barHasMainAction: boolean;
  held: boolean;
  kind: LessonKind;
  run: GenerationRun;
  since: number;
}) {
  const t = useExtracted();

  return (
    <GenerationWait
      barHasMainAction={barHasMainAction}
      kind={kind}
      run={held ? toHeldRun(run) : run}
      since={since}
    >
      {!held && (
        <GenerationTimelineDescription className="text-sm">
          {t("Your lesson is usually ready in a few minutes.")}
        </GenerationTimelineDescription>
      )}
    </GenerationWait>
  );
}

/** The lesson's writing as the wait screen shows it: a strip over the quiz, or its progress. */
export function Waiting({
  actions,
  barHasMainAction,
  block,
  failed,
  generationId,
  kind,
  lesson,
  onInterrupted,
  onRunStopped,
}: {
  actions: NextStopActions;
  barHasMainAction: boolean;
  block: DayStep;
  failed: boolean;
  generationId: string | null;
  kind: LessonKind;
  lesson: NextStopLesson;
  onInterrupted: () => void;
  onRunStopped: () => void;
}) {
  const held = lesson === "ready";
  const runId = useHeldRunId({ generationId, held });
  const since = useMountTime().getTime();

  if (failed) {
    const failure = (
      <GenerationFailureNotice
        barHasMainAction={barHasMainAction}
        failure="generation"
        retry={() => void actions.start(block)}
      />
    );

    return <WaitContent progress={failure} status={failure} />;
  }

  const content = (run: GenerationRun) => {
    const shown = toAwaitedRun(run);

    return (
      <>
        <ReportStopped onStopped={onRunStopped} run={run} />
        <WaitContent
          progress={
            <WritingProgress
              barHasMainAction={barHasMainAction}
              held={held}
              kind={kind}
              run={shown}
              since={since}
            />
          }
          status={
            shown.status === "failed" ? (
              <GenerationFailureNotice
                barHasMainAction={barHasMainAction}
                failure={shown.failure ?? "connection"}
                retry={shown.retry}
              />
            ) : (
              <LessonWaitStatus holding={held} kind={kind} run={shown} since={since} />
            )
          }
        />
      </>
    );
  };

  if (!runId) {
    return content(UNNAMED_RUN);
  }

  return (
    <FollowedRun
      generationId={runId}
      key={runId}
      kind={kind}
      onInterrupted={onInterrupted}
      onReady={actions.refresh}
      restart={async () => ((await actions.start(block)) ? undefined : null)}
    >
      {content}
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

/** A verb for what the learner can do meanwhile; only an unusual step needs its name. */
function useAlternativeLabel() {
  const t = useExtracted();
  const title = useBlockTitle();

  return (alternative: DayStep): string => {
    if (alternative.checkpoint) {
      return t({
        description:
          '{title} is the name of one of the day\'s challenges, such as "Weekly challenge", never a course.',
        message: "Start {title}",
        values: { title: title(alternative) },
      });
    }

    if (alternative.kind === "review") {
      return t("Review now");
    }

    return t("Practice now");
  };
}

export function AlternativeButton({
  actions,
  alternative,
}: {
  actions: NextStopActions;
  alternative: DayStep;
}) {
  const label = useAlternativeLabel();
  const other = useSessionAction({ action: () => actions.start(alternative), enterKey: true });

  return (
    <form action={() => void other.run()} className="contents">
      <EnterButton busy={other.isPending} enter="host" type="submit">
        {label(alternative)}
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
