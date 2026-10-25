"use client";

import { Button } from "@zoonk/ui/components/button";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { useExtracted } from "next-intl";
import { type ReactNode } from "react";
import { EnterButton } from "../_components/enter-button";
import { TaskActionBar, TaskActions, TaskBody } from "../_components/task-layout";
import { type TestOutStart } from "../_components/test-out-start-link";
import { SessionHeader } from "./session-header";
import { getSessionQueue } from "./session-queue-rows";
import { type StudyBlock, type StudyMomentView, type StudySession } from "./session-types";
import { StudyMoment } from "./study-moment";
import { useMomentEvents } from "./use-moment-events";
import { useSessionAction } from "./use-session-action";

/** The lesson player's completion as this moment reads it. */
type LessonMomentCompletion = {
  result: { studyBlock: StudyMomentView | null } | null;
  status: "failed" | "saved" | "saving";
  testedOut: boolean;
};

type LessonMomentSession = Pick<StudySession, "blocks" | "missions">;

function SavedMoment({
  moment,
  onContinue,
  onStartTestOut,
  onStop,
  session,
  testedOut,
}: {
  moment: StudyMomentView;
  onContinue: () => Promise<boolean>;
  onStartTestOut: (chapterId: string) => Promise<TestOutStart>;
  onStop: () => Promise<boolean>;
  session: LessonMomentSession;
  testedOut: boolean;
}) {
  useMomentEvents({ missionsBefore: session.missions, moment });

  return (
    <StudyMoment
      blocks={session.blocks}
      missionsBefore={session.missions}
      finishedChapterId={
        session.blocks.find((block) => block.id === moment.blockId)?.chapterId ?? null
      }
      inLessonPlayer
      kind="learn"
      moment={moment}
      next={session.blocks.find((block) => block.id === moment.nextBlockId) ?? null}
      onContinue={onContinue}
      onStartTestOut={onStartTestOut}
      onStop={onStop}
      testedOut={testedOut}
    />
  );
}

/**
 * The lesson was saved but isn't one of the day's blocks anymore (a replay, or a session left the
 * day before): Continue goes on with the day, and says so when it couldn't.
 */
function OutsideSession({ onContinue }: { onContinue: () => Promise<boolean> }) {
  const t = useExtracted();
  const { failed, isPending, run } = useSessionAction({ action: onContinue, enterKey: true });

  return (
    <>
      <TaskBody>
        <h2 className="text-title" role="status">
          {t("Lesson complete")}
        </h2>
      </TaskBody>

      <TaskActionBar>
        {failed && (
          <p className="text-destructive-text text-sm" role="alert">
            {t("We couldn't open the next step. Try again.")}
          </p>
        )}

        <TaskActions>
          <EnterButton disabled={isPending} onClick={run}>
            {t("Continue")}
          </EnterButton>
        </TaskActions>
      </TaskActionBar>
    </>
  );
}

/**
 * The header over a lesson's completion moment when it's one of today's blocks: the session's,
 * with the day as one segment per block (each as long as its minutes when the day's `blocks` are
 * given), like between every other block, in place of the lesson's own segments, and the lesson's
 * `menu` (its summary card). Nothing until the lesson is saved (the lesson's header stays
 * meanwhile).
 */
export function LessonMomentHeader({
  blocks,
  completion,
  exitHref,
  menu,
}: {
  blocks?: readonly StudyBlock[];
  completion: LessonMomentCompletion;
  exitHref: string;
  menu?: ReactNode;
}) {
  const moment = completion.result?.studyBlock ?? null;

  if (!moment) {
    return null;
  }

  const queue = blocks
    ? getSessionQueue({ blocks, finishedId: moment.blockId, nextId: moment.nextBlockId }).rows
    : undefined;

  return (
    <SessionHeader exitHref={exitHref} menu={menu} queue={queue} sessionBar={moment.sessionBar} />
  );
}

/**
 * A lesson's completion moment when it's one of today's blocks, the same as every block's: what it
 * earned and when it comes back, the session bar, what's next, then one tap back into the
 * session. The host puts it in the lesson player's completion slot, under the player's header.
 */
export function LessonMoment({
  completion,
  onContinue,
  onRetry,
  onStartTestOut,
  onStop,
  session,
}: {
  completion: LessonMomentCompletion;
  onContinue: () => Promise<boolean>;
  onRetry: () => void;
  /** Opens a chapter's test: the one the moment offers, or the next lesson's. */
  onStartTestOut: (chapterId: string) => Promise<TestOutStart>;
  onStop: () => Promise<boolean>;
  session: LessonMomentSession;
}) {
  const t = useExtracted();
  const moment = completion.result?.studyBlock ?? null;

  if (completion.status === "failed") {
    return (
      <TaskBody className="items-start" role="alert">
        <p className="text-[0.9375rem] font-medium text-balance">
          {t("We couldn't save your progress yet.")}
        </p>
        <Button onClick={onRetry} size="lg" variant="outline">
          {t("Try again")}
        </Button>
      </TaskBody>
    );
  }

  if (!moment && completion.status === "saved") {
    return <OutsideSession onContinue={onContinue} />;
  }

  if (!moment) {
    return (
      <TaskBody role="status">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-48" />
        <span className="sr-only">{t("Saving your progress…")}</span>
      </TaskBody>
    );
  }

  return (
    <SavedMoment
      moment={moment}
      onContinue={onContinue}
      onStartTestOut={onStartTestOut}
      onStop={onStop}
      session={session}
      testedOut={completion.testedOut}
    />
  );
}
