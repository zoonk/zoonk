"use client";

import {
  type LanguageConversationCompletionInput,
  type LanguageConversationView,
} from "@zoonk/core/language/conversations/contract";
import { Button } from "@zoonk/ui/components/button";
import { Spinner } from "@zoonk/ui/components/spinner";
import { useExtracted } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { type CallLimit } from "../../_components/help-limit-notice";
import { TaskFrame, TaskMainButton, TaskMainLink } from "../../shell/task-frame";
import { CallLimitMessage } from "./call-limit-message";
import { ConversationIntro } from "./conversation-intro";
import { useConversationTitle } from "./conversation-labels";
import { ConversationLive } from "./conversation-live";
import { ConversationResult } from "./conversation-result";
import { SpeakingMockResult } from "./speaking-mock-result";
import { type LiveCallActions, type LiveCallError, useLiveCall } from "./use-live-call";

export type { ConversationConnection } from "./use-live-call";

export type ConversationActions = LiveCallActions & {
  /** Saves the finished call and returns it with its result; null when saving failed. */
  complete: (
    input: Omit<LanguageConversationCompletionInput, "timeZone">,
  ) => Promise<LanguageConversationView | null>;
  /** Starts another speaking mock and opens it; only for mocks. */
  startAgain?: () => Promise<void>;
};

export type ConversationHrefs = { exit: string; next: string };

function ProblemMessage({ text, title }: { text: string; title: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center" role="alert">
      <p className="text-lg font-semibold text-balance">{title}</p>
      <p className="text-muted-foreground text-balance">{text}</p>
    </div>
  );
}

/**
 * Why the call stopped, never the learner's fault, with the one thing to do next: try again
 * (a dropped call can also end here, which saves what was said), or go back when there's nothing
 * to retry.
 */
function CallProblem({
  error,
  exitHref,
  limit,
  onEnd,
  onRetry,
  title,
}: {
  error: LiveCallError | null;
  exitHref: string;
  limit: CallLimit | null;
  onEnd: () => void;
  onRetry: () => void;
  title: string;
}) {
  const t = useExtracted();

  if (error === "limit" || error === "ended") {
    return (
      <TaskFrame
        exitHref={exitHref}
        footer={<TaskMainLink href={exitHref}>{t("Back")}</TaskMainLink>}
        headerTitle={title}
      >
        {error === "limit" ? (
          <CallLimitMessage limit={limit ?? { period: "day", tier: "plus" }} />
        ) : (
          <ProblemMessage
            text={t("Start a new call to keep practicing.")}
            title={t("This call has ended")}
          />
        )}
      </TaskFrame>
    );
  }

  if (error === "dropped") {
    return (
      <TaskFrame
        exitHref={null}
        footer={
          <>
            <TaskMainButton onClick={onRetry}>{t("Call again")}</TaskMainButton>
            <Button className="w-full" onClick={onEnd} size="xl" variant="outline">
              {t("End the call")}
            </Button>
          </>
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
      footer={<TaskMainButton onClick={onRetry}>{t("Try again")}</TaskMainButton>}
      headerTitle={title}
    >
      <ProblemMessage
        text={t("This happens sometimes. Try again in a moment.")}
        title={t("The call didn't connect")}
      />
    </TaskFrame>
  );
}

function SavingCall({ failed, onRetry }: { failed: boolean; onRetry: () => void }) {
  const t = useExtracted();

  if (failed) {
    return (
      <div className="flex flex-col items-center gap-4 py-10 text-center" role="alert">
        <p>{t("We couldn't save the call.")}</p>
        <TaskMainButton onClick={onRetry}>{t("Try again")}</TaskMainButton>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center" role="status">
      <Spinner className="size-6" />
      <p>{t("Writing your feedback…")}</p>
    </div>
  );
}

/** How a call run begins: on its intro, or calling right away after "Try again". */
type RunStart = "call" | "intro";

const FIRST_RUN = { attempt: 0, startWith: "intro" } as const;

/** One call from the first ring to hanging up, then saved once with what was said. */
function LiveCallRun({
  actions,
  conversation,
  hrefs,
  onRestart,
  onSaved,
  startWith,
}: {
  actions: ConversationActions;
  conversation: LanguageConversationView;
  hrefs: ConversationHrefs;
  onRestart: (startWith: RunStart) => void;
  onSaved: (view: LanguageConversationView) => void;
  startWith: RunStart;
}) {
  const title = useConversationTitle(conversation);
  const call = useLiveCall({ actions, conversation });
  const [usedHelp, setUsedHelp] = useState(false);
  const [saving, setSaving] = useState<"failed" | "saving" | null>(null);
  const { start } = call;

  const save = useCallback(async () => {
    setSaving("saving");
    const view = await actions.complete({ ...(await call.finish()), usedHelp });

    if (view) {
      onSaved(view);
    } else {
      setSaving("failed");
    }
  }, [actions, call, onSaved, usedHelp]);

  // Hanging up, or the call reaching its length, saves it once.
  const saved = useRef(false);

  useEffect(() => {
    if (call.phase === "ended" && !saved.current) {
      saved.current = true;
      void save();
    }
  }, [call.phase, save]);

  // "Try again" calls right away, once: React may run this effect twice for the same run.
  const autoStarted = useRef(false);

  useEffect(() => {
    if (startWith === "call" && !autoStarted.current) {
      autoStarted.current = true;
      void start();
    }
  }, [start, startWith]);

  // A call that hasn't connected yet has nothing to save: ending it goes back to the intro.
  const end = call.phase === "connecting" ? () => onRestart("intro") : call.hangUp;

  if (call.phase === "idle" && startWith === "intro") {
    return (
      <ConversationIntro
        conversation={conversation}
        exitHref={hrefs.exit}
        onStart={() => void start()}
      />
    );
  }

  if (saving || call.phase === "ended") {
    return (
      <TaskFrame exitHref={null} headerTitle={title}>
        <SavingCall failed={saving === "failed"} onRetry={() => void save()} />
      </TaskFrame>
    );
  }

  if (call.phase === "failed") {
    return (
      <CallProblem
        error={call.error}
        exitHref={hrefs.exit}
        limit={call.limit}
        onEnd={call.hangUp}
        onRetry={() => onRestart("call")}
        title={title}
      />
    );
  }

  return (
    <ConversationLive
      call={call}
      conversation={conversation}
      onEnd={end}
      onHelp={() => setUsedHelp(true)}
      usedHelp={usedHelp}
    />
  );
}

/**
 * A live conversation from its intro to its result: a unit's practice call, a language goal's
 * checkpoint or an IELTS or TOEFL speaking mock. The host supplies the view model, how to save the
 * call and where to go after.
 */
export function ConversationScreen({
  actions,
  conversation,
  hrefs,
}: {
  actions: ConversationActions;
  conversation: LanguageConversationView;
  hrefs: ConversationHrefs;
}) {
  const [view, setView] = useState(conversation);
  const [run, setRun] = useState<{ attempt: number; startWith: RunStart }>(FIRST_RUN);
  const { result } = view;

  if (result && view.kind === "speakingMock") {
    return (
      <SpeakingMockResult
        conversation={view}
        exitHref={hrefs.exit}
        feedback={result.feedback?.kind === "speakingMock" ? result.feedback : null}
        nextHref={hrefs.next}
        onTryAgain={actions.startAgain ?? null}
      />
    );
  }

  if (result) {
    return (
      <ConversationResult
        conversation={view}
        exitHref={hrefs.exit}
        nextHref={hrefs.next}
        result={result}
      />
    );
  }

  return (
    <LiveCallRun
      actions={actions}
      conversation={view}
      hrefs={hrefs}
      key={run.attempt}
      onRestart={(startWith) => setRun((current) => ({ attempt: current.attempt + 1, startWith }))}
      onSaved={setView}
      startWith={run.startWith}
    />
  );
}
