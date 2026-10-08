"use client";

import { Button } from "@zoonk/ui/components/button";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { CheckIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { EnterButton } from "../_components/enter-button";
import { type TestOutStart } from "../_components/test-out-start-link";
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
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col px-4">
      <StudyMoment
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
    </div>
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
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col px-4 py-6 lg:justify-center-safe">
      <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center lg:flex-none">
        <span className="bg-success/10 text-success animate-in zoom-in-50 fade-in flex size-20 items-center justify-center rounded-full duration-500 ease-out motion-reduce:animate-none">
          <CheckIcon aria-hidden="true" className="size-10" strokeWidth={2.5} />
        </span>
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl" role="status">
          {t("Lesson complete")}
        </h2>
      </div>

      <EnterButton className="mt-8" disabled={isPending} onClick={run}>
        {t("Continue")}
      </EnterButton>

      {failed && (
        <p className="text-destructive mt-3 text-center text-sm" role="alert">
          {t("We couldn't open the next step. Try again.")}
        </p>
      )}
    </div>
  );
}

/**
 * A lesson's completion moment when it's one of today's blocks, the same as every block's: the
 * check, its Brain Power and what's next, when it comes back, the session bar, then one tap back
 * into the session. The host puts it in the lesson player's completion slot.
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
      <div
        className="mx-auto my-auto flex w-full max-w-xl flex-col items-center gap-4 px-4 py-8 text-center"
        role="alert"
      >
        <p className="text-lg font-medium text-balance">
          {t("We couldn't save your progress yet.")}
        </p>
        <Button onClick={onRetry} size="lg" variant="outline">
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
      <div
        className="mx-auto my-auto flex w-full max-w-xl flex-col items-center gap-6 px-4 py-8"
        role="status"
      >
        <Skeleton className="size-20 rounded-full" />
        <Skeleton className="h-9 w-2/3" />
        <Skeleton className="h-8 w-48 rounded-full" />
        <span className="sr-only">{t("Saving your progress…")}</span>
      </div>
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
