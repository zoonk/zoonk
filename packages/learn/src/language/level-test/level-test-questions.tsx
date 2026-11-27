"use client";

import {
  type LanguageLevelTestView,
  type LevelTestAnswerInput,
} from "@zoonk/core/language/level-test/contract";
import { Button } from "@zoonk/ui/components/button";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { usePoll } from "../../_utils/use-poll";
import { PlacementQuestionScreen } from "../../onboarding/steps/placement-question";
import { useTestFacts } from "../../placement-test/use-test-facts";
import { useSpokenAudio } from "../../speech/use-spoken-audio";
import { useSkillName } from "../_utils/use-skill-name";
import { ListeningMessage } from "./level-test-parts";
import { type ReadyLevelTest } from "./level-test-phase";

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

type Sent = "answer" | "defer" | null;

function AskedQuestion({
  audioPending,
  failures,
  onAnswer,
  onClose,
  onStop,
  pending,
  step,
  targetLanguage,
  test,
}: {
  audioPending: boolean;
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
  const t = useExtracted();
  const facts = useTestFacts();
  const skillName = useSkillName();
  const [sent, setSent] = useState<Sent>(null);
  const speech = useSpokenAudio(targetLanguage);
  const { question } = step;
  const isListening = question.skill === "listening";
  const noAudio = isListening && (audioPending || speech.state.status === "failed");
  const listeningOut = noAudio ? t("Skip this question") : t("I didn't understand the audio");
  const number = test.answered + 1;

  const send = (
    kind: Exclude<Sent, null>,
    input: Omit<LevelTestAnswerInput, "attemptId" | "questionId">,
  ) => {
    setSent(kind);
    onAnswer({ ...input, questionId: question.id });
  };

  return (
    <PlacementQuestionScreen
      canStop={test.canStop}
      dontKnowLabel={isListening ? listeningOut : undefined}
      failures={failures}
      media={
        isListening ? (
          <div className="flex flex-col gap-2">
            <ListeningMessage
              language={targetLanguage}
              pending={audioPending}
              question={question}
              speech={speech}
            />
            <Button
              busy={pending && sent === "defer"}
              className="self-start"
              disabled={pending}
              focusableWhenDisabled
              onClick={() => send("defer", { answerIndex: null, audioDeferred: true })}
              type="button"
              variant="link"
            >
              {t({
                description:
                  "Button on a listening question for a learner who can't play sound right now, such as on a bus. It ends the listening questions for this test.",
                message: "Can't listen now",
              })}
            </Button>
          </div>
        ) : null
      }
      number={number}
      onAnswer={(choice, durationMs) => {
        const answerIndices = "selectedIndexes" in choice ? choice.selectedIndexes : undefined;

        send("answer", {
          answerIndex: "selectedIndex" in choice ? choice.selectedIndex : null,
          durationMs,
          ...(answerIndices && { answerIndices }),
          ...(noAudio && "dontKnow" in choice && { skipped: true }),
        });
      }}
      onClose={onClose}
      onStop={onStop}
      pending={pending}
      position={[facts.question({ number, total: test.total })]}
      progress={test.answered / test.total}
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
      subject={skillName(question.skill)}
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
