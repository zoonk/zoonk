"use client";

import {
  type CompletedLanguageConversation,
  type LanguageConversationCompletionInput,
  type LanguageConversationView,
} from "@zoonk/core/language/conversations/contract";
import { NOTHING_REACHED } from "@zoonk/core/sessions/reached";
import { CelebrationScope } from "@zoonk/ui/hooks/celebration";
import { useCallback, useEffect, useRef, useState } from "react";
import { type LearnBuddy } from "../../buddies/use-buddy-name";
import { DayMoment } from "../../session/day-moment";
import { type MomentCeremony, getCeremonyMoment } from "../../session/moment-ceremony";
import { ExamSpeakingResult } from "../exam-speaking/exam-speaking-result";
import { CallProblem, SavingCall } from "./call-problem";
import { ConversationIntro } from "./conversation-intro";
import { useConversationTitle } from "./conversation-labels";
import { ConversationLive } from "./conversation-live";
import { ConversationResult } from "./conversation-result";
import { SpeakingMockResult } from "./speaking-mock-result";
import { type TappedCallAudio } from "./use-call-microphone";
import { type LiveCallActions, useLiveCall } from "./use-live-call";

export type { ConversationConnection } from "./use-call-connection";
export type { TappedCallAudio } from "./use-call-microphone";

type ConversationCompletion =
  | { conversation: CompletedLanguageConversation; status: "completed" }
  | { status: "ended" | "failed" | "takenOver" };

export type ConversationActions = LiveCallActions & {
  complete: (
    input: Omit<LanguageConversationCompletionInput, "timeZone">,
  ) => Promise<ConversationCompletion>;
  startAgain?: () => Promise<void>;
};

export type ConversationHrefs = { exit: string; next: string; nextTask?: (task: string) => string };

type RunStart = "call" | "intro" | "takeover";

type SaveState = "closing" | "ended" | "failed" | "saving" | "takenOver";

const FIRST_RUN = { attempt: 0, startWith: "intro" } as const;

const SAVE_FAILED = { status: "failed" } as const;

function LiveCallRun({
  actions,
  callAudio,
  conversation,
  hrefs,
  onRestart,
  onSaved,
  startWith,
}: {
  actions: ConversationActions;
  callAudio?: TappedCallAudio;
  conversation: LanguageConversationView;
  hrefs: ConversationHrefs;
  onRestart: (startWith: RunStart) => void;
  onSaved: (view: CompletedLanguageConversation) => void;
  startWith: RunStart;
}) {
  const title = useConversationTitle(conversation);
  const call = useLiveCall({ actions, conversation, tappedAudio: callAudio });
  const [usedHelp, setUsedHelp] = useState(false);
  const [saving, setSaving] = useState<SaveState | null>(null);
  const { finish, start } = call;

  const save = useCallback(async () => {
    setSaving("saving");
    const summary = await finish();

    // Nothing is saved, reviewed or rewarded until the server confirmed the call closed.
    if (!summary) {
      setSaving("closing");
      return;
    }

    const completion = await actions.complete({ ...summary, usedHelp }).catch(() => SAVE_FAILED);

    if (completion.status === "completed") {
      onSaved(completion.conversation);
      return;
    }

    setSaving(completion.status);
  }, [actions, finish, onSaved, usedHelp]);

  const saved = useRef(false);

  useEffect(() => {
    if (call.phase === "ended" && !saved.current) {
      saved.current = true;
      void save();
    }
  }, [call.phase, save]);

  // The start waits a microtask the cleanup cancels, so Strict Mode's replayed effect starts the
  // call only once.
  const autoStarted = useRef(false);

  useEffect(() => {
    if (startWith === "intro" || autoStarted.current) {
      return;
    }

    const replaced = new AbortController();

    queueMicrotask(() => {
      if (replaced.signal.aborted || autoStarted.current) {
        return;
      }

      autoStarted.current = true;
      void start(startWith === "takeover");
    });

    return () => replaced.abort();
  }, [start, startWith]);

  const end = call.phase === "connecting" ? () => onRestart("intro") : call.hangUp;

  const locked = conversation.locked || call.error === "plusRequired";

  if (locked || (call.phase === "idle" && startWith === "intro")) {
    return (
      <ConversationIntro
        conversation={conversation}
        exitHref={hrefs.exit}
        locked={locked}
        onStart={() => void start()}
      />
    );
  }

  const problem = {
    exitHref: hrefs.exit,
    onEnd: call.hangUp,
    onRetry: () => onRestart("call"),
    onTakeover: () => onRestart("takeover"),
    title,
  };

  if (saving === "ended" || saving === "takenOver") {
    return <CallProblem {...problem} error={saving} limit={null} />;
  }

  if (saving || call.phase === "ended") {
    return (
      <SavingCall
        grading={conversation.kind === "speakingMock" || conversation.examTask !== null}
        onRetry={() => void save()}
        state={saving ?? "saving"}
        title={title}
      />
    );
  }

  if (call.phase === "failed") {
    return <CallProblem {...problem} error={call.error} limit={call.limit} />;
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

export function ConversationScreen({
  actions,
  buddy,
  callAudio,
  conversation,
  hrefs,
  onSaved,
  renderCeremony,
}: {
  actions: ConversationActions;
  buddy?: LearnBuddy | null;
  callAudio?: TappedCallAudio;
  conversation: LanguageConversationView;
  hrefs: ConversationHrefs;
  onSaved?: () => void;
  renderCeremony?: MomentCeremony;
}) {
  // A call opened after it ended was celebrated then, so it gets no ceremony.
  const [view, setView] = useState<CompletedLanguageConversation>({
    ...conversation,
    ceremony: null,
    missionMoment: null,
    reached: NOTHING_REACHED,
  });

  const [run, setRun] = useState<{ attempt: number; startWith: RunStart }>({
    ...FIRST_RUN,
    startWith: callAudio ? "call" : "intro",
  });

  // oxlint-disable-next-line react/hook-use-state -- Read once as the screen opens, never updated.
  const [openedWithResult] = useState(Boolean(conversation.result));
  const { result } = view;
  const ceremony = getCeremonyMoment({ milestone: view.ceremony, render: renderCeremony });

  const dayMoment = (
    <DayMoment
      buddy={buddy}
      ceremony={view.ceremony}
      missionMoment={view.missionMoment}
      reached={view.reached}
    />
  );

  if (result && view.kind === "speakingMock") {
    return (
      <SpeakingMockResult
        ceremony={ceremony}
        conversation={view}
        dayMoment={dayMoment}
        exitHref={hrefs.exit}
        feedback={result.feedback?.kind === "speakingMock" ? result.feedback : null}
        nextHref={hrefs.next}
        onTryAgain={actions.startAgain ?? null}
      />
    );
  }

  if (result && view.examTask) {
    return (
      <ExamSpeakingResult
        ceremony={ceremony}
        conversation={view}
        dayMoment={dayMoment}
        examTask={view.examTask}
        exitHref={hrefs.exit}
        feedback={result.feedback?.kind === "examSpeaking" ? result.feedback : null}
        nextHref={hrefs.next}
        nextTaskHref={
          view.examTask.nextTask && hrefs.nextTask ? hrefs.nextTask(view.examTask.nextTask) : null
        }
        onTryAgain={actions.startAgain ?? null}
      />
    );
  }

  if (result) {
    return (
      <CelebrationScope play={!openedWithResult}>
        <ConversationResult
          ceremony={ceremony}
          conversation={view}
          dayMoment={dayMoment}
          exitHref={hrefs.exit}
          nextHref={hrefs.next}
          result={result}
        />
      </CelebrationScope>
    );
  }

  return (
    <LiveCallRun
      actions={actions}
      callAudio={callAudio}
      conversation={view}
      hrefs={hrefs}
      key={run.attempt}
      onRestart={(startWith) => setRun((current) => ({ attempt: current.attempt + 1, startWith }))}
      onSaved={onSaved ?? setView}
      startWith={run.startWith}
    />
  );
}
