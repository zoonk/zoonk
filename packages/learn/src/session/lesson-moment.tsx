"use client";

import { type FinishedChapter } from "@zoonk/core/sessions/completion-contract";
import { type ProgressCelebration } from "@zoonk/core/sessions/progress-celebration";
import { useExtracted } from "next-intl";
import { type ReactNode } from "react";
import { EnterButton } from "../_components/enter-button";
import { MomentReadouts } from "../_components/moment-readouts";
import { TaskActionBar, TaskActions, TaskBody } from "../_components/task-layout";
import { type TestOutStart } from "../_components/test-out-start-link";
import { useStudyTimeFact } from "../_utils/time-format";
import { type LearnBuddy } from "../buddies/use-buddy-name";
import { NextStepFailed } from "./action-failed";
import { DayMoment } from "./day-moment";
import { FailedMoment } from "./failed-moment";
import { MomentHeader } from "./moment-header";
import { PendingMoment } from "./pending-moment";
import { SessionHeader } from "./session-header";
import { type StudyMomentView } from "./session-types";
import { StudyMoment } from "./study-moment";
import { useMomentTitle } from "./use-moment-title";
import { useSessionAction } from "./use-session-action";

type LessonMomentCompletion = {
  failures: number;
  result:
    | (ProgressCelebration & {
        brainPower: number;
        finishedChapter: FinishedChapter | null;
        seconds: number;
        studyBlock: StudyMomentView | null;
      })
    | null;
  status: "failed" | "saved" | "saving";
  testedOut: boolean;
};

type OutsideSessionResult = NonNullable<LessonMomentCompletion["result"]>;

function SavedMoment({
  buddy,
  moment,
  onContinue,
  onStartTestOut,
  onStop,
  continueHref,
  testedOut,
}: {
  buddy?: LearnBuddy | null;
  moment: StudyMomentView;
  onContinue: () => Promise<boolean>;
  onStartTestOut: (chapterId: string) => Promise<TestOutStart>;
  onStop: () => Promise<boolean>;
  continueHref?: string | null;
  testedOut: boolean;
}) {
  return (
    <StudyMoment
      continueHref={continueHref}
      buddy={buddy}
      finishedChapterId={moment.finishedChapterId}
      inLessonPlayer
      kind="learn"
      moment={moment}
      next={moment.next?.block ?? null}
      onContinue={onContinue}
      onStartTestOut={onStartTestOut}
      onStop={onStop}
      testedOut={testedOut}
    />
  );
}

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
  const studied = useStudyTimeFact(result?.seconds ?? 0);
  const { failed, isPending, run } = useSessionAction({ action: onContinue, enterKey: true });

  return (
    <>
      <TaskBody>
        <MomentHeader title={title}>
          {result && <MomentReadouts brainPower={result.brainPower} facts={[studied]} />}
        </MomentHeader>

        {result && (
          <DayMoment
            buddy={buddy}
            ceremony={result.ceremony}
            finishedChapter={result.finishedChapter}
            missionMoment={null}
            reached={result.reached}
          />
        )}
      </TaskBody>

      <TaskActionBar note={failed && <NextStepFailed />}>
        <TaskActions>
          <EnterButton busy={isPending} enter="host" onClick={run}>
            {t("Continue")}
          </EnterButton>
        </TaskActions>
      </TaskActionBar>
    </>
  );
}

/** Nothing until the lesson is saved, while the lesson's own header stays. */
export function LessonMomentHeader({
  completion,
  exitHref,
  menu,
}: {
  completion: LessonMomentCompletion;
  exitHref: string;
  menu?: ReactNode;
}) {
  if (!completion.result?.studyBlock) {
    return null;
  }

  return <SessionHeader exitHref={exitHref} menu={menu} />;
}

export function LessonMoment({
  buddy,
  completion,
  onContinue,
  onRetry,
  onStartTestOut,
  onStop,
  continueHref,
}: {
  buddy?: LearnBuddy | null;
  completion: LessonMomentCompletion;
  onContinue: () => Promise<boolean>;
  onRetry: () => void;
  onStartTestOut: (chapterId: string) => Promise<TestOutStart>;
  onStop: () => Promise<boolean>;
  continueHref?: string | null;
}) {
  const t = useExtracted();
  const title = useMomentTitle({ kind: "learn", testedOut: completion.testedOut });
  const result = completion.result;
  const moment = result?.studyBlock ?? null;

  if (completion.status === "failed") {
    return <FailedMoment failures={completion.failures} onRetry={onRetry} />;
  }

  if (!moment && completion.status === "saved") {
    return <OutsideSession buddy={buddy} onContinue={onContinue} result={result} title={title} />;
  }

  if (!result || !moment) {
    return <PendingMoment action={t("Continue")} />;
  }

  return (
    <SavedMoment
      buddy={buddy}
      moment={moment}
      onContinue={onContinue}
      onStartTestOut={onStartTestOut}
      onStop={onStop}
      continueHref={continueHref}
      testedOut={completion.testedOut}
    />
  );
}
