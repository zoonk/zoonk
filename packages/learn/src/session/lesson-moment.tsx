"use client";

import { type ProgressCelebration } from "@zoonk/core/sessions/progress-celebration";
import { useExtracted, useFormatter } from "next-intl";
import { type ReactNode } from "react";
import { EnterButton } from "../_components/enter-button";
import { MomentReadouts } from "../_components/moment-readouts";
import { TaskActionBar, TaskActions, TaskBody } from "../_components/task-layout";
import { type TestOutStart } from "../_components/test-out-start-link";
import { type LearnBuddy } from "../buddies/use-buddy-name";
import { DayMoment } from "./day-moment";
import { MomentHeader, MomentSaveFailed } from "./moment-header";
import { PendingMoment } from "./pending-moment";
import { SessionHeader } from "./session-header";
import { type StudyMomentView, type StudySession } from "./session-types";
import { StudyMoment } from "./study-moment";
import { useMomentEvents } from "./use-moment-events";
import { useMomentTitle } from "./use-moment-title";
import { useSessionAction } from "./use-session-action";

/**
 * The lesson player's completion as this moment reads it: a lesson that's no longer one of the
 * day's blocks says what it earned and celebrates what it reached itself.
 */
type LessonMomentCompletion = {
  result:
    | (ProgressCelebration & {
        brainPower: number;
        nextReviewAt: string | null;
        studyBlock: StudyMomentView | null;
      })
    | null;
  status: "failed" | "saved" | "saving";
  testedOut: boolean;
};

type OutsideSessionResult = NonNullable<LessonMomentCompletion["result"]>;

type LessonMomentSession = Pick<StudySession, "blocks">;

function SavedMoment({
  buddy,
  moment,
  onContinue,
  onStartTestOut,
  onStop,
  session,
  testedOut,
}: {
  buddy?: LearnBuddy | null;
  moment: StudyMomentView;
  onContinue: () => Promise<boolean>;
  onStartTestOut: (chapterId: string) => Promise<TestOutStart>;
  onStop: () => Promise<boolean>;
  session: LessonMomentSession;
  testedOut: boolean;
}) {
  useMomentEvents({ moment });

  return (
    <StudyMoment
      blocks={session.blocks}
      buddy={buddy}
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
 * day before): what it earned and when it comes back, then the belt level and the tenth of Energy
 * it reached, as every result says them (its milestone opened before, from the lesson player's
 * `ceremony`), and Continue goes on with the day, saying so when it couldn't.
 */
function OutsideSession({
  buddy,
  onContinue,
  result,
  title,
}: {
  buddy?: LearnBuddy | null;
  onContinue: () => Promise<boolean>;
  result: OutsideSessionResult | null;
  title: string;
}) {
  const t = useExtracted();
  const format = useFormatter();
  const { failed, isPending, run } = useSessionAction({ action: onContinue, enterKey: true });

  return (
    <>
      <TaskBody>
        <MomentHeader title={title}>
          {result && (
            <MomentReadouts
              brainPower={result.brainPower}
              facts={[
                result.nextReviewAt &&
                  t("Review on {date}", {
                    date: format.dateTime(new Date(result.nextReviewAt), {
                      day: "numeric",
                      month: "short",
                    }),
                  }),
              ]}
            />
          )}
        </MomentHeader>

        {result && (
          <DayMoment
            buddy={buddy}
            ceremony={result.ceremony}
            missionMoment={null}
            reached={result.reached}
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
 * with the day as one segment per block, like between every other block, in place of the lesson's
 * own segments, and the lesson's `menu` (its summary card). Nothing until the lesson is saved (the lesson's header stays
 * meanwhile).
 */
export function LessonMomentHeader({
  completion,
  exitHref,
  menu,
}: {
  completion: LessonMomentCompletion;
  exitHref: string;
  menu?: ReactNode;
}) {
  const moment = completion.result?.studyBlock ?? null;

  if (!moment) {
    return null;
  }

  return <SessionHeader exitHref={exitHref} menu={menu} sessionBar={moment.sessionBar} />;
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
  session: LessonMomentSession;
}) {
  const t = useExtracted();
  const title = useMomentTitle({ kind: "learn", testedOut: completion.testedOut });
  const moment = completion.result?.studyBlock ?? null;

  if (completion.status === "failed") {
    return (
      <TaskBody>
        <MomentHeader title={title}>
          <MomentSaveFailed onRetry={onRetry} />
        </MomentHeader>
      </TaskBody>
    );
  }

  if (!moment && completion.status === "saved") {
    return (
      <OutsideSession
        buddy={buddy}
        onContinue={onContinue}
        result={completion.result}
        title={title}
      />
    );
  }

  if (!moment) {
    return <PendingMoment action={t("Continue")} title={title} />;
  }

  return (
    <SavedMoment
      buddy={buddy}
      moment={moment}
      onContinue={onContinue}
      onStartTestOut={onStartTestOut}
      onStop={onStop}
      session={session}
      testedOut={completion.testedOut}
    />
  );
}
