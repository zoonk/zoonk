"use client";

import { Button } from "@zoonk/ui/components/button";
import { Spinner } from "@zoonk/ui/components/spinner";
import { useTakingLong } from "@zoonk/ui/hooks/taking-long";
import { useExtracted } from "next-intl";
import { type ReactNode } from "react";
import { type CallLimit } from "../../_components/help-limit-notice";
import { TaskActions } from "../../_components/task-layout";
import { TaskFrame, TaskMainButton, TaskMainLink } from "../../shell/task-frame";
import { CallLimitMessage } from "./call-limit-message";
import { CallOffMessage } from "./conversation-parts";
import { type LiveCallError } from "./live-call-lifecycle";

type CallProblemKind = LiveCallError | "takenOver";

function ProblemMessage({ text, title }: { text: string; title: string }) {
  return (
    <CallOffMessage title={title}>
      <p className="text-muted-foreground text-pretty">{text}</p>
    </CallOffMessage>
  );
}

function ProblemWithBack({
  children,
  exitHref,
  title,
}: {
  children: ReactNode;
  exitHref: string;
  title: string;
}) {
  const t = useExtracted();

  return (
    <TaskFrame
      exitHref={exitHref}
      footer={
        <TaskActions>
          <TaskMainLink href={exitHref}>{t("Back")}</TaskMainLink>
        </TaskActions>
      }
      headerTitle={title}
    >
      {children}
    </TaskFrame>
  );
}

export function CallProblem({
  error,
  exitHref,
  limit,
  onEnd,
  onRetry,
  onTakeover,
  title,
}: {
  error: CallProblemKind | null;
  exitHref: string;
  limit: CallLimit | null;
  onEnd: () => void;
  onRetry: () => void;
  onTakeover: () => void;
  title: string;
}) {
  const t = useExtracted();

  if (error === "limit") {
    return (
      <ProblemWithBack exitHref={exitHref} title={title}>
        <CallLimitMessage limit={limit ?? { period: "day", tier: "plus" }} />
      </ProblemWithBack>
    );
  }

  if (error === "ended" || error === "takenOver") {
    return (
      <ProblemWithBack exitHref={exitHref} title={title}>
        <ProblemMessage
          text={
            error === "takenOver"
              ? t("It ended when you started another call.")
              : t("Start a new call to keep practicing.")
          }
          title={t("This call has ended")}
        />
      </ProblemWithBack>
    );
  }

  if (error === "callsPaused") {
    return (
      <ProblemWithBack exitHref={exitHref} title={title}>
        <ProblemMessage
          text={t({
            description:
              'Under the title "Calls are paused": the pause applies to every learner, not only this one.',
            message: "It's the same for everyone right now. Try again later.",
          })}
          title={t("Calls are paused")}
        />
      </ProblemWithBack>
    );
  }

  if (error === "callInProgress") {
    return (
      <TaskFrame
        exitHref={exitHref}
        footer={
          <TaskActions>
            <TaskMainButton onClick={onTakeover}>
              {t({
                description:
                  "Another call is still running: this ends it and starts the call on this screen.",
                message: "End that call and start this one",
              })}
            </TaskMainButton>
          </TaskActions>
        }
        headerTitle={title}
      >
        <ProblemMessage
          text={t(
            "It's open in another tab or on another device. Ending it from here skips its feedback.",
          )}
          title={t("You're already in a call")}
        />
      </TaskFrame>
    );
  }

  if (error === "dropped") {
    return (
      <TaskFrame
        exitHref={null}
        footer={
          <TaskActions>
            <Button className="shrink-0" onClick={onEnd} size="lg" variant="outline">
              {t("End the call")}
            </Button>
            <TaskMainButton onClick={onRetry}>{t("Call again")}</TaskMainButton>
          </TaskActions>
        }
        headerTitle={title}
      >
        <ProblemMessage
          text={t("Call again, or end the call to get feedback on what you said.")}
          title={t("The call dropped")}
        />
      </TaskFrame>
    );
  }

  return (
    <TaskFrame
      exitHref={exitHref}
      footer={
        <TaskActions>
          <TaskMainButton onClick={onRetry}>{t("Try again")}</TaskMainButton>
        </TaskActions>
      }
      headerTitle={title}
    >
      <ProblemMessage
        text={t("This happens sometimes. Try again in a moment.")}
        title={t("The call didn't connect")}
      />
    </TaskFrame>
  );
}

/** A call's feedback takes a few seconds, an exam's grade 13 to 33 s (about 23 for most). */
const SLOW_SAVE_MS = { feedback: 20_000, grade: 45_000 } as const;

export function SavingLine({ grading }: { grading: boolean }) {
  const t = useExtracted();
  const afterMs = SLOW_SAVE_MS[grading ? "grade" : "feedback"];
  const isSlow = useTakingLong({ active: true, afterMs });

  if (grading) {
    return isSlow
      ? t("Still rating your speaking. This is taking longer than usual.")
      : t("Rating your speaking on the exam's criteria. It usually takes about half a minute.");
  }

  return isSlow
    ? t("Still writing your feedback. This is taking longer than usual.")
    : t("Writing your feedback…");
}

/** The live screen keeps its transcript while the call saves, so the end never reads as a drop. */
export function CallEndedStatus({
  grading,
  onRetry,
  state,
}: {
  grading: boolean;
  onRetry: () => void;
  state: "closing" | "failed" | "saving";
}) {
  const t = useExtracted();

  if (state === "saving") {
    return (
      <div className="flex min-h-11 items-center gap-3" data-slot="call-ended">
        <span
          aria-hidden="true"
          className="bg-secondary grid size-8 shrink-0 place-items-center rounded-full"
        >
          <Spinner className="size-4" />
        </span>
        <p className="flex min-w-0 flex-col text-pretty">
          <span className="text-sm leading-5 font-medium">{t("Call ended")}</span>
          <span className="text-muted-foreground text-[0.8125rem] leading-snug">
            <SavingLine grading={grading} />
          </span>
        </p>
      </div>
    );
  }

  return (
    <>
      <p className="text-sm text-pretty" role="alert">
        {state === "closing"
          ? t("The call is still closing. Try again in a moment.")
          : t("We couldn't save the call.")}
      </p>
      <TaskActions>
        <TaskMainButton onClick={onRetry}>{t("Try again")}</TaskMainButton>
      </TaskActions>
    </>
  );
}
