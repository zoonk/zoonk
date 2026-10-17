"use client";

import {
  type CompletedLanguageConversation,
  type LanguageConversationCompletionInput,
  type LanguageConversationView,
} from "@zoonk/core/language/conversations/contract";
import { useCallback, useEffect, useRef, useState } from "react";
import { TaskFrame } from "../../shell/task-frame";
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

/**
 * Saving a finished call: it with its result and what it did to the day's missions, or why it
 * wasn't saved: it ended or another call took it over (nothing is reviewed), the server is still
 * closing it, or saving failed.
 */
type ConversationCompletion =
  | { conversation: CompletedLanguageConversation; status: "completed" }
  | { status: "ended" | "failed" | "previousConnectionClosing" | "takenOver" };

export type ConversationActions = LiveCallActions & {
  /** Saves the finished call, under the connection it ran on. */
  complete: (
    input: Omit<LanguageConversationCompletionInput, "timeZone">,
  ) => Promise<ConversationCompletion>;
  /** Starts another speaking mock, or the same exam task with a new card, and opens it. */
  startAgain?: () => Promise<void>;
};

/**
 * Where the call leads: out (`exit`), on after its result (`next`), and for an exam task, the
 * paper's next task opened where its list is (`nextTask`, by key; nothing is written until the
 * learner starts it).
 */
export type ConversationHrefs = { exit: string; next: string; nextTask?: (task: string) => string };

/**
 * How a call run begins: on its intro, calling right away after "Try again", or calling right away
 * after ending the learner's other call ("End that call and start this one").
 */
type RunStart = "call" | "intro" | "takeover";

/** Where saving a finished call stands. */
type SaveState = "closing" | "ended" | "failed" | "saving" | "takenOver";

const FIRST_RUN = { attempt: 0, startWith: "intro" } as const;

const SAVE_FAILED = { status: "failed" } as const;

/** One call from the first ring to hanging up, then saved once with what was said. */
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

    setSaving(completion.status === "previousConnectionClosing" ? "closing" : completion.status);
  }, [actions, finish, onSaved, usedHelp]);

  // Hanging up, or the call reaching its length, saves it once.
  const saved = useRef(false);

  useEffect(() => {
    if (call.phase === "ended" && !saved.current) {
      saved.current = true;
      void save();
    }
  }, [call.phase, save]);

  // "Try again" and the takeover call right away, once per run (the intro waits for its button).
  // The start waits a microtask that this effect's cleanup cancels: when React replays the effect
  // (Strict Mode), the first one never starts a call its own cleanup would cancel, and the replay
  // starts it.
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

  // A call that hasn't connected yet has nothing to save: ending it goes back to the intro.
  const end = call.phase === "connecting" ? () => onRestart("intro") : call.hangUp;

  // A call the learner's plan leaves to Plus shows its intro locked, with "See Plus" in place of
  // Start: from the start (`locked`), or once a call is refused for it (Plus lapsed while its intro
  // was open).
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
      <TaskFrame exitHref={null} headerTitle={title}>
        <SavingCall onRetry={() => void save()} state={saving ?? "saving"} />
      </TaskFrame>
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

/**
 * A live conversation from its intro to its result: a unit's practice call, a language goal's
 * checkpoint, an IELTS or TOEFL speaking mock, or a task of a DELE, DELF, Goethe or Cambridge
 * speaking paper. The host supplies the view model, how to save the call and where to go after.
 */
export function ConversationScreen({
  actions,
  callAudio,
  conversation,
  hrefs,
  onSaved,
}: {
  actions: ConversationActions;
  /**
   * Continues a Start tap that first had to create the checkpoint's conversation: the call starts
   * at once, with the microphone that tap opened.
   */
  callAudio?: TappedCallAudio;
  conversation: LanguageConversationView;
  hrefs: ConversationHrefs;
  /**
   * Leads on once the call is saved instead of showing its result: a running mock's task, since a
   * mock gives no feedback until it's over (its result opens each task's then, and says what its
   * calls did to the day's missions: see `MockView.missionMoment`).
   */
  onSaved?: () => void;
}) {
  // The call as it was last saved here: once it ends, with what it did to the day's missions.
  const [view, setView] = useState<CompletedLanguageConversation>({
    ...conversation,
    missionMoment: null,
  });

  const [run, setRun] = useState<{ attempt: number; startWith: RunStart }>({
    ...FIRST_RUN,
    startWith: callAudio ? "call" : "intro",
  });

  const { result } = view;

  if (result && view.kind === "speakingMock") {
    return (
      <SpeakingMockResult
        conversation={view}
        exitHref={hrefs.exit}
        feedback={result.feedback?.kind === "speakingMock" ? result.feedback : null}
        missionMoment={view.missionMoment}
        nextHref={hrefs.next}
        onTryAgain={actions.startAgain ?? null}
      />
    );
  }

  if (result && view.examTask) {
    return (
      <ExamSpeakingResult
        conversation={view}
        examTask={view.examTask}
        exitHref={hrefs.exit}
        feedback={result.feedback?.kind === "examSpeaking" ? result.feedback : null}
        missionMoment={view.missionMoment}
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
      <ConversationResult
        conversation={view}
        exitHref={hrefs.exit}
        missionMoment={view.missionMoment}
        nextHref={hrefs.next}
        result={result}
      />
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
