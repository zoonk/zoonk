"use client";

import {
  type LanguageConversationCompletionInput,
  type LanguageConversationView,
} from "@zoonk/core/language/conversations/contract";
import { Button } from "@zoonk/ui/components/button";
import { Spinner } from "@zoonk/ui/components/spinner";
import { useExtracted } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { TaskFrame, TaskMainButton, TaskMainLink } from "../../shell/task-frame";
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

function CallProblem({
  error,
  exitHref,
  onEnd,
  onRetry,
}: {
  error: LiveCallError | null;
  exitHref: string;
  onEnd: () => void;
  onRetry: () => void;
}) {
  const t = useExtracted();

  if (error === "limit") {
    return (
      <div className="flex flex-col items-center gap-4 py-10 text-center" role="alert">
        <p className="text-lg font-semibold">{t("No more calls on your plan today")}</p>
        <p className="text-muted-foreground in-data-[mode=fun]:text-fun-fg2">
          {t("Your calls come back tomorrow. Everything you learned today is saved.")}
        </p>
        <TaskMainLink href={exitHref}>{t("Back")}</TaskMainLink>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 py-10 text-center" role="alert">
      <p className="text-lg font-semibold">{t("The call dropped")}</p>
      <p className="text-muted-foreground in-data-[mode=fun]:text-fun-fg2">
        {t("Check your connection and try again, or end the call here.")}
      </p>
      <div className="flex gap-2">
        <Button onClick={onRetry}>{t("Try again")}</Button>
        <Button onClick={onEnd} variant="outline">
          {t("End the call")}
        </Button>
      </div>
    </div>
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

/** One call from the first ring to hanging up, then saved once with what was said. */
function LiveCallRun({
  actions,
  conversation,
  hrefs,
  onRestart,
  onSaved,
}: {
  actions: ConversationActions;
  conversation: LanguageConversationView;
  hrefs: ConversationHrefs;
  onRestart: () => void;
  onSaved: (view: LanguageConversationView) => void;
}) {
  const title = useConversationTitle(conversation);
  const call = useLiveCall({ actions, conversation });
  const [usedHelp, setUsedHelp] = useState(false);
  const [saving, setSaving] = useState<"failed" | "saving" | null>(null);

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

  const end = call.hangUp;

  if (call.phase === "idle") {
    return (
      <ConversationIntro
        conversation={conversation}
        exitHref={hrefs.exit}
        onStart={() => void call.start()}
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
      <TaskFrame exitHref={hrefs.exit} headerTitle={title}>
        <CallProblem error={call.error} exitHref={hrefs.exit} onEnd={end} onRetry={onRestart} />
      </TaskFrame>
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
 * checkpoint (Fun's boss) or an IELTS or TOEFL speaking mock. Both modes run the same call; Fun
 * shows confidence and stars where Focus lists the goals. The host supplies the view model, how to
 * save the call and where to go after.
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
  const [attempt, setAttempt] = useState(0);
  const { result } = view;

  if (result && view.kind === "speakingMock") {
    return (
      <SpeakingMockResult
        conversation={view}
        feedback={result.feedback?.kind === "speakingMock" ? result.feedback : null}
        nextHref={hrefs.next}
        onTryAgain={actions.startAgain ?? null}
      />
    );
  }

  if (result) {
    return <ConversationResult conversation={view} nextHref={hrefs.next} result={result} />;
  }

  return (
    <LiveCallRun
      actions={actions}
      conversation={view}
      hrefs={hrefs}
      key={attempt}
      onRestart={() => setAttempt((value) => value + 1)}
      onSaved={setView}
    />
  );
}
