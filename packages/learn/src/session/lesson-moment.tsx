"use client";

import { Button } from "@zoonk/ui/components/button";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { useExtracted } from "next-intl";
import { type StudyMomentView, type StudySession } from "./session-types";
import { StudyMoment } from "./study-moment";
import { useMomentEvents } from "./use-moment-events";
import { useSessionAction } from "./use-session-action";

/** The lesson player's completion as this moment reads it. */
type LessonMomentCompletion = {
  result: { studyBlock: StudyMomentView | null } | null;
  status: "failed" | "saved" | "saving";
  testedOut: boolean;
};

type LessonMomentSession = { missions: StudySession["missions"] };

function SavedMoment({
  feedback,
  moment,
  onContinue,
  onStop,
  session,
  testedOut,
}: {
  feedback: React.ReactNode;
  moment: StudyMomentView;
  onContinue: () => Promise<boolean>;
  onStop: () => Promise<boolean>;
  session: LessonMomentSession;
  testedOut: boolean;
}) {
  useMomentEvents({ missionsBefore: session.missions, moment });

  return (
    <div className="mx-auto w-full max-w-2xl px-4">
      <StudyMoment
        kind="learn"
        moment={moment}
        onContinue={onContinue}
        onStop={onStop}
        inLessonPlayer
        testedOut={testedOut}
      >
        {feedback}
      </StudyMoment>
    </div>
  );
}

/** The lesson was saved but isn't one of today's blocks anymore (a replay, or another day). */
function OutsideSession({ onContinue }: { onContinue: () => Promise<boolean> }) {
  const t = useExtracted();
  const { isPending, run } = useSessionAction({ action: onContinue, enterKey: true });

  return (
    <div className="mx-auto my-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8">
      <h2 className="text-3xl font-semibold tracking-tight" role="status">
        {t("Lesson complete")}
      </h2>
      <Button className="h-12 rounded-full" disabled={isPending} onClick={run} size="lg">
        {t("Continue")}
      </Button>
    </div>
  );
}

/**
 * A lesson's completion moment when it's one of today's blocks: the check, its Brain Power, one
 * more step on the session bar and when it comes back, a quiet thumbs row, then one tap back into
 * the session. The host puts it in the lesson player's completion slot.
 */
export function LessonMoment({
  completion,
  feedback,
  onContinue,
  onRetry,
  onStop,
  session,
}: {
  completion: LessonMomentCompletion;
  /** The quiet thumbs row about the lesson, from the host's feedback components. */
  feedback?: React.ReactNode;
  onContinue: () => Promise<boolean>;
  onRetry: () => void;
  onStop: () => Promise<boolean>;
  session: LessonMomentSession;
}) {
  const t = useExtracted();
  const moment = completion.result?.studyBlock ?? null;

  if (completion.status === "failed") {
    return (
      <div
        className="mx-auto my-auto flex w-full max-w-2xl flex-col items-start gap-3 px-4 py-8"
        role="alert"
      >
        <p>{t("We couldn't save your progress yet.")}</p>
        <Button onClick={onRetry} variant="outline">
          {t("Try again")}
        </Button>
      </div>
    );
  }

  if (!moment && completion.status === "saved") {
    return <OutsideSession onContinue={onContinue} />;
  }

  if (!moment) {
    return (
      <div className="mx-auto my-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-8" role="status">
        <Skeleton className="size-14 rounded-full" />
        <Skeleton className="h-9 w-2/3" />
        <Skeleton className="h-16 w-32 rounded-2xl" />
        <span className="sr-only">{t("Saving your progress…")}</span>
      </div>
    );
  }

  return (
    <SavedMoment
      feedback={feedback}
      moment={moment}
      onContinue={onContinue}
      onStop={onStop}
      session={session}
      testedOut={completion.testedOut}
    />
  );
}
