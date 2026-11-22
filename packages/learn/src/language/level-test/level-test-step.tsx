"use client";

import {
  type LanguageLevelTestView,
  type LevelTestAnswerInput,
} from "@zoonk/core/language/level-test/contract";
import { usePoll } from "../../_utils/use-poll";
import { LevelTestQuestion, SpeakingStep } from "./level-test-questions";

const POLL_MS = 3000;

type ReadyTest = Extract<LanguageLevelTestView, { status: "ready" }>;

/** What a level test's question screens send. */
export type LevelTestQuestionActions = {
  answer: (input: LevelTestAnswerInput) => Promise<LanguageLevelTestView | null>;
  speak: (audio: Blob) => Promise<LanguageLevelTestView | "noSpeech" | "signUpRequired" | null>;
};

function hasQuestion(
  next: ReadyTest["next"],
): next is Extract<ReadyTest["next"], { kind: "confirmation" | "question" }> {
  return next.kind === "question" || next.kind === "confirmation";
}

export function useLevelTestAudio({
  onRead,
  read,
  test,
}: {
  onRead: (view: ReadyTest) => void;
  read: () => Promise<LanguageLevelTestView | null>;
  test: ReadyTest | null;
}) {
  const next = test?.next;
  const question = next && hasQuestion(next) ? next.question : null;

  const poll = usePoll({
    active: Boolean(question?.audioPending),
    intervalMs: POLL_MS,
    key: question?.id,
    onPoll: async (signal) => {
      const view = await read();

      if (!view) {
        throw new Error("The level test couldn't be read");
      }

      if (
        !signal.aborted &&
        view.status === "ready" &&
        hasQuestion(view.next) &&
        view.next.question.id === question?.id
      ) {
        onRead(view);
      }
    },
    startNow: false,
  });

  return poll.status === "polling";
}

export function TestStep({
  actions,
  audioPending,
  next,
  onStop,
  onView,
  progress,
  targetLanguage,
}: {
  actions: LevelTestQuestionActions;
  audioPending: boolean;
  next: ReadyTest["next"];
  onStop: () => void;
  onView: (view: LanguageLevelTestView) => void;
  progress: number;
  targetLanguage: string;
}) {
  if (next.kind === "speaking") {
    return (
      <SpeakingStep
        onSkip={onStop}
        onView={onView}
        progress={progress}
        sentence={next}
        speak={actions.speak}
      />
    );
  }

  return hasQuestion(next) ? (
    <LevelTestQuestion
      answer={actions.answer}
      audioPending={audioPending}
      key={next.question.id}
      onStop={onStop}
      onView={onView}
      progress={progress}
      question={next.question}
      selectAll={next.kind === "confirmation"}
      targetLanguage={targetLanguage}
    />
  ) : null;
}
