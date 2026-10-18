"use client";

import { Button } from "@zoonk/ui/components/button";
import { Spinner } from "@zoonk/ui/components/spinner";
import { useExtracted } from "next-intl";
import { type ReactNode } from "react";
import { type CallLimit } from "../../_components/help-limit-notice";
import { TaskActions } from "../../_components/task-layout";
import { TaskFrame, TaskMainButton, TaskMainLink } from "../../shell/task-frame";
import { CallLimitMessage } from "./call-limit-message";
import { CallOffMessage } from "./conversation-parts";
import { type LiveCallError } from "./use-live-call";

/** Why a call can't go on: the live call's problem, or a finished call another call took over. */
type CallProblemKind = LiveCallError | "takenOver";

/** Why the call can't go on: one title and one sentence. */
function ProblemMessage({ text, title }: { text: string; title: string }) {
  return (
    <CallOffMessage title={title}>
      <p className="text-muted-foreground text-pretty">{text}</p>
    </CallOffMessage>
  );
}

/** A problem with nothing to retry: the call's screen with one way back. */
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

/**
 * Why the call stopped, never the learner's fault, with the one thing to do next: try again (a
 * dropped call can also end here, which saves what was said), end the learner's other call and
 * start this one, or go back when there's nothing to retry. Calls paused (switched off, or not
 * available right now) says so plainly instead of pretending the call failed.
 */
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
          text={t("It's the same for everyone right now. Try again later.")}
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
              {t("End that call and start this one")}
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

/**
 * Saving a finished call: its feedback being written, or why not yet, with a way to try again.
 * While the server hasn't confirmed the call closed, nothing is saved and the transcript waits
 * here; trying again asks the server to close it again.
 */
export function SavingCall({
  onRetry,
  state,
}: {
  onRetry: () => void;
  state: "closing" | "failed" | "saving";
}) {
  const t = useExtracted();

  if (state === "saving") {
    return (
      <p className="text-muted-foreground flex items-center gap-2 py-6" role="status">
        <Spinner aria-hidden="true" />
        {t("Writing your feedback…")}
      </p>
    );
  }

  return (
    <div className="flex flex-col items-start gap-4 py-6" role="alert">
      <p>
        {state === "closing"
          ? t("The call is still closing. Try again in a moment.")
          : t("We couldn't save the call.")}
      </p>
      <TaskMainButton onClick={onRetry}>{t("Try again")}</TaskMainButton>
    </div>
  );
}
