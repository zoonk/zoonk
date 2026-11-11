"use client";

import { type FinishedChapter } from "@zoonk/core/sessions/completion-contract";
import { type ProgressCelebration } from "@zoonk/core/sessions/progress-celebration";
import { FORWARD_ICON } from "@zoonk/ui/components/button";
import { useExtracted, useFormatter } from "next-intl";
import { type ReactNode } from "react";
import { EnterButton } from "../_components/enter-button";
import { MomentReadouts } from "../_components/moment-readouts";
import { TaskActionBar, TaskActions, TaskBody } from "../_components/task-layout";
import { type TestOutStart } from "../_components/test-out-start-link";
import { useStudyTimeFact } from "../_utils/time-format";
import { type LearnBuddy } from "../buddies/use-buddy-name";
import { FinishedChapterMoment } from "../mind-maps/finished-chapter-map";
import { type ReminderOfferActions } from "../reminders/reminder-offer";
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
        nextReviewAt: string | null;
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
  lessonSeconds,
  moment,
  onContinue,
  onStartTestOut,
  onStop,
  continueHref,
  reminderActions,
  testedOut,
}: {
  buddy?: LearnBuddy | null;
  lessonSeconds: number;
  moment: StudyMomentView;
  onContinue: () => Promise<boolean>;
  onStartTestOut: (chapterId: string) => Promise<TestOutStart>;
  onStop: () => Promise<boolean>;
  continueHref?: string | null;
  reminderActions: ReminderOfferActions;
  testedOut: boolean;
}) {
  return (
    <StudyMoment
      continueHref={continueHref}
      buddy={buddy}
      finishedChapterId={moment.finishedChapterId}
      inLessonPlayer
      kind="learn"
      lessonSeconds={lessonSeconds}
      moment={moment}
      next={moment.next?.block ?? null}
      onContinue={onContinue}
      onStartTestOut={onStartTestOut}
      onStop={onStop}
      reminderActions={reminderActions}
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
  const format = useFormatter();
  const studied = useStudyTimeFact(result?.seconds ?? 0);
  const { failed, isPending, run } = useSessionAction({ action: onContinue, enterKey: true });

  return (
    <>
      <TaskBody>
        <MomentHeader title={title}>
          {result && (
            <MomentReadouts
              brainPower={result.brainPower}
              facts={[
                studied,
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

        <FinishedChapterMoment chapter={result?.finishedChapter ?? null} />
      </TaskBody>

      <TaskActionBar>
        {failed && (
          <p className="text-destructive-text text-sm" role="alert">
            {t("We couldn't open the next step. Try again.")}
          </p>
        )}

        <TaskActions>
          <EnterButton busy={isPending} onClick={run} {...FORWARD_ICON}>
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
  const moment = completion.result?.studyBlock ?? null;

  if (!moment) {
    return null;
  }

  return <SessionHeader exitHref={exitHref} menu={menu} sessionBar={moment.sessionBar} />;
}

export function LessonMoment({
  buddy,
  completion,
  onContinue,
  onRetry,
  onStartTestOut,
  onStop,
  continueHref,
  reminderActions,
}: {
  buddy?: LearnBuddy | null;
  completion: LessonMomentCompletion;
  onContinue: () => Promise<boolean>;
  onRetry: () => void;
  onStartTestOut: (chapterId: string) => Promise<TestOutStart>;
  onStop: () => Promise<boolean>;
  continueHref?: string | null;
  reminderActions: ReminderOfferActions;
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
      lessonSeconds={result.seconds}
      moment={moment}
      onContinue={onContinue}
      onStartTestOut={onStartTestOut}
      onStop={onStop}
      continueHref={continueHref}
      reminderActions={reminderActions}
      testedOut={completion.testedOut}
    />
  );
}
