"use client";

import {
  type LanguageLevelTestView,
  type LevelTestAnswerInput,
} from "@zoonk/core/language/level-test/contract";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { SteadyLabel } from "../../_components/steady-label";
import { usePoll } from "../../_utils/use-poll";
import { PlacementQuestionScreen } from "../../onboarding/steps/placement-question";
import { useSpokenAudio } from "../../speech/use-spoken-audio";
import { useSkillName } from "../_utils/use-skill-name";
import { ListeningMessage } from "./level-test-parts";
import {
  type ListeningOut,
  type ReadyLevelTest,
  toLevelTestGroups,
  toListeningOut,
} from "./level-test-phase";

const POLL_MS = 3000;

type AskedStep = Extract<ReadyLevelTest["next"], { kind: "confirmation" | "question" }>;

function isAsked(next: ReadyLevelTest["next"]): next is AskedStep {
  return next.kind === "question" || next.kind === "confirmation";
}

export function useLevelTestAudio({
  onRead,
  read,
  test,
}: {
  onRead: (view: ReadyLevelTest) => void;
  read: () => Promise<LanguageLevelTestView | null>;
  test: ReadyLevelTest | null;
}) {
  const next = test?.next;
  const question = next && isAsked(next) ? next.question : null;

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
        isAsked(view.next) &&
        view.next.question.id === question?.id
      ) {
        onRead(view);
      }
    },
    startNow: false,
  });

  return poll.status === "polling";
}

const LISTENING_OUTS = ["cantListen", "notUnderstood", "skip"] as const satisfies ListeningOut[];

function useListeningOuts(): Record<ListeningOut, string> {
  const t = useExtracted();

  return {
    cantListen: t({
      description:
        "Button on a listening question for a learner who can't play sound right now, such as on a bus. It ends the listening questions for this test.",
      message: "Can't listen now",
    }),
    notUnderstood: t({
      description:
        "Button on a listening question, after the learner played the message: they heard it and didn't understand it.",
      message: "I didn't understand",
    }),
    skip: t("Skip this question"),
  };
}

function AskedQuestion({
  audioArriving,
  failures,
  onAnswer,
  onClose,
  onStop,
  pending,
  step,
  targetLanguage,
  test,
}: {
  /** The recording is still being made and this screen is still checking for it. */
  audioArriving: boolean;
  /** Saves from this question (answers and Stop) that failed in a row. */
  failures: number;
  onAnswer: (input: Omit<LevelTestAnswerInput, "attemptId">) => void;
  onClose: () => void;
  onStop: () => void;
  /** An answer or Stop is saving. */
  pending: boolean;
  step: AskedStep;
  targetLanguage: string;
  test: ReadyLevelTest;
}) {
  const skillName = useSkillName();
  const outs = useListeningOuts();
  const [heard, setHeard] = useState(false);
  const speech = useSpokenAudio(targetLanguage);
  const { question } = step;
  const isListening = question.skill === "listening";

  const out = toListeningOut({
    audioPending: question.audioPending,
    heard,
    playFailed: speech.state.status === "failed",
  });

  // An answer, a skip or a stop ends the question, so a message still playing stops with it.
  const send = (input: Omit<LevelTestAnswerInput, "attemptId" | "questionId">) => {
    speech.cancel();
    onAnswer({ ...input, questionId: question.id });
  };

  return (
    <PlacementQuestionScreen
      answered={test.answered}
      canStop={test.canStop}
      failures={failures}
      groups={toLevelTestGroups(test.total)}
      media={
        isListening ? (
          <ListeningMessage
            language={targetLanguage}
            onHeard={() => setHeard(true)}
            pending={audioArriving}
            question={question}
            speech={speech}
          />
        ) : null
      }
      onAnswer={(choice, durationMs) => {
        const answerIndices = "selectedIndexes" in choice ? choice.selectedIndexes : undefined;

        send({
          answerIndex: "selectedIndex" in choice ? choice.selectedIndex : null,
          durationMs,
          ...(answerIndices && { answerIndices }),
          ...(isListening && out === "skip" && "dontKnow" in choice && { skipped: true }),
        });
      }}
      onClose={onClose}
      onStop={() => {
        speech.cancel();
        onStop();
      }}
      pending={pending}
      question={{
        context: isListening ? null : question.passage,
        format: "multipleChoice",
        image: null,
        itemId: question.id,
        options: question.options,
        question: question.question,
        // A level's check: every right option is picked, so a guess rarely passes.
        select: step.kind === "confirmation" ? "all" : 1,
        skillId: question.skill,
        visual: null,
      }}
      second={
        isListening
          ? {
              label: (
                <SteadyLabel
                  labels={LISTENING_OUTS.map((name) => outs[name])}
                  shown={LISTENING_OUTS.indexOf(out)}
                />
              ),
              onPress:
                out === "cantListen"
                  ? () => send({ answerIndex: null, audioDeferred: true })
                  : undefined,
            }
          : undefined
      }
      subject={skillName(question.skill)}
      total={test.total}
    />
  );
}

export function LevelTestQuestion({
  test,
  ...props
}: Omit<React.ComponentProps<typeof AskedQuestion>, "step">) {
  const { next } = test;

  return isAsked(next) ? (
    <AskedQuestion key={next.question.id} step={next} test={test} {...props} />
  ) : null;
}
