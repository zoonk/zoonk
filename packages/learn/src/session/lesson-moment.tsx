"use client";

import { type ProgressCelebration } from "@zoonk/core/sessions/progress-celebration";
import { Button } from "@zoonk/ui/components/button";
import { useExtracted } from "next-intl";
import { type ReactNode } from "react";
import { EnterButton } from "../_components/enter-button";
import { TaskActionBar, TaskActions, TaskBody } from "../_components/task-layout";
import { type TestOutStart } from "../_components/test-out-start-link";
import { type LearnBuddy } from "../buddies/use-buddy-name";
import { DayMoment } from "./day-moment";
import { MOMENT_TITLE_PROPS, type MomentCeremony } from "./moment-ceremony";
import { PendingMoment } from "./pending-moment";
import { SessionHeader } from "./session-header";
import { getSessionQueue } from "./session-queue-rows";
import { type StudyBlock, type StudyMomentView, type StudySession } from "./session-types";
import { StudyMoment } from "./study-moment";
import { useMomentEvents } from "./use-moment-events";
import { useSessionAction } from "./use-session-action";

/**
 * The lesson player's completion as this moment reads it: a lesson that's no longer one of the
 * day's blocks celebrates what it reached itself.
 */
type LessonMomentCompletion = {
  result: (ProgressCelebration & { studyBlock: StudyMomentView | null }) | null;
  status: "failed" | "saved" | "saving";
  testedOut: boolean;
};

type LessonMomentSession = Pick<StudySession, "blocks">;

function SavedMoment({
  buddy,
  moment,
  onContinue,
  onStartTestOut,
  onStop,
  renderCeremony,
  session,
  testedOut,
}: {
  buddy?: LearnBuddy | null;
  moment: StudyMomentView;
  onContinue: () => Promise<boolean>;
  onStartTestOut: (chapterId: string) => Promise<TestOutStart>;
  onStop: () => Promise<boolean>;
  renderCeremony?: MomentCeremony;
  session: LessonMomentSession;
  testedOut: boolean;
}) {
  useMomentEvents({ moment });

  return (
    <StudyMoment
      blocks={session.blocks}
      buddy={buddy}
      renderCeremony={renderCeremony}
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
 * day before): the belt level and the tenth of Energy it reached, as every result says them (its
 * milestone opened before, from the lesson player's `ceremony`), and Continue goes on with the day,
 * saying so when it couldn't.
 */
function OutsideSession({
  buddy,
  celebration,
  onContinue,
}: {
  buddy?: LearnBuddy | null;
  celebration: ProgressCelebration | null;
  onContinue: () => Promise<boolean>;
}) {
  const t = useExtracted();
  const { failed, isPending, run } = useSessionAction({ action: onContinue, enterKey: true });

  return (
    <>
      <TaskBody>
        <h2 className="text-title outline-none" role="status" {...MOMENT_TITLE_PROPS}>
          {t("Lesson complete")}
        </h2>

        {celebration && (
          <DayMoment
            buddy={buddy}
            ceremony={celebration.ceremony}
            missionMoment={null}
            reached={celebration.reached}
          />
        )}
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
  buddy,
  completion,
  onContinue,
  onRetry,
  onStartTestOut,
  onStop,
  renderCeremony,
  session,
}: {
  /** The learner's buddy, who cheers when the lesson completes one of the day's missions. */
  buddy?: LearnBuddy | null;
  completion: LessonMomentCompletion;
  onContinue: () => Promise<boolean>;
  onRetry: () => void;
  /** Opens a chapter's test: the one the moment offers, or the next lesson's. */
  onStartTestOut: (chapterId: string) => Promise<TestOutStart>;
  onStop: () => Promise<boolean>;
  /** The full-screen moment for a milestone the lesson earned (a new belt, new glasses). */
  renderCeremony?: MomentCeremony;
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
    return <OutsideSession buddy={buddy} celebration={completion.result} onContinue={onContinue} />;
  }

  if (!moment) {
    return <PendingMoment kind="learn" testedOut={completion.testedOut} />;
  }

  return (
    <SavedMoment
      buddy={buddy}
      renderCeremony={renderCeremony}
      moment={moment}
      onContinue={onContinue}
      onStartTestOut={onStartTestOut}
      onStop={onStop}
      session={session}
      testedOut={completion.testedOut}
    />
  );
}
