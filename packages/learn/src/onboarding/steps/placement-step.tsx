"use client";

import { type TrueFalseLabels } from "@zoonk/core/library/exams/true-false-labels";
import { safeAsync } from "@zoonk/utils/error";
import { useRef, useState, useTransition } from "react";
import { usePoll } from "../../_utils/use-poll";
import { type GenerationRun } from "../../generation/generation-run";
import {
  type OnboardingActions,
  type PlacementAnswer,
  type PlacementOutcome,
  type PlacementQuestion,
} from "../onboarding-actions";
import { PlacementQuestionScreen } from "./placement-question";
import { PlacementDone, PlacementIntro, PlacementUnavailable } from "./placement-screens";
import { PlacementWaiting } from "./placement-waiting";
import { StepLoadFailed, StepLoading } from "./step-parts";
import { rememberStepStart, wasStepStarted } from "./step-started";
import { useReadOnOpen } from "./use-read-on-open";
import { isRunStopped } from "./wait-run";

const POLL_MS = 3000;

type ReadyOutcome = Extract<PlacementOutcome, { status: "ready" }>;

type Phase =
  | { kind: "done" | "intro" | "loadFailed" | "loading" | "unavailable" | "waiting" }
  | {
      answered: number;
      failures: number;
      kind: "question";
      question: PlacementQuestion;
      /** 0 to 1. */
      spent: number;
      trueFalseLabels: TrueFalseLabels;
    };

/**
 * The server's counts can shrink while the plan is still being written, and neither a question's
 * number nor the bar goes back.
 */
type Shown = { answered: number; spent: number };

const NOTHING_SHOWN: Shown = { answered: 0, spent: 0 };

function toPhase(outcome: ReadyOutcome, shown: Shown = NOTHING_SHOWN): Phase {
  const answered = Math.max(outcome.answered, shown.answered);

  return outcome.next && !outcome.complete
    ? {
        answered,
        failures: 0,
        kind: "question",
        question: outcome.next,
        spent: Math.max(outcome.dayBudgetSpent, shown.spent),
        trueFalseLabels: outcome.trueFalseLabels,
      }
    : { kind: "done" };
}

/** Counts a save on the question it came from; a save from another screen leaves questions alone. */
function countSave({
  current,
  from,
  saved,
}: {
  current: Phase;
  from: Phase;
  saved: boolean;
}): Phase {
  return current.kind === "question" &&
    from.kind === "question" &&
    current.question.itemId === from.question.itemId
    ? { ...current, failures: saved ? 0 : current.failures + 1 }
    : current;
}

function toResumedPhase({
  outcome,
  tapped,
}: {
  outcome: PlacementOutcome;
  tapped: boolean;
}): Phase {
  if (outcome.status === "failed") {
    return { kind: "loadFailed" };
  }

  if (outcome.status === "ready" && (tapped || outcome.started)) {
    return toPhase(outcome);
  }

  if (!tapped) {
    return { kind: "intro" };
  }

  return outcome.status === "unavailable" ? { kind: "unavailable" } : { kind: "waiting" };
}

function useResumedPlacement({ actions, goalId }: { actions: OnboardingActions; goalId: string }) {
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const shown = useRef(NOTHING_SHOWN);

  const showPhase = (next: Phase) => {
    if (next.kind === "question") {
      shown.current = { answered: next.answered, spent: next.spent };
    }

    setPhase(next);
  };

  const showReady = (outcome: ReadyOutcome) => showPhase(toPhase(outcome, shown.current));

  const countAnswer = (answered: number) => {
    shown.current = {
      answered: Math.max(shown.current.answered, answered + 1),
      spent: shown.current.spent,
    };
  };

  const reopen = useReadOnOpen({
    onRead: (outcome) =>
      showPhase(
        toResumedPhase({
          outcome: outcome ?? { status: "failed" },
          tapped: wasStepStarted({ goalId, step: "placement" }),
        }),
      ),
    read: () => actions.getPlacement(goalId),
  });

  const start = async () => {
    rememberStepStart({ goalId, step: "placement" });
    const { data: outcome } = await safeAsync(() => actions.getPlacement(goalId));

    if (outcome?.status === "ready") {
      showReady(outcome);
      return;
    }

    setPhase({ kind: outcome?.status === "unavailable" ? "unavailable" : "waiting" });
  };

  return { countAnswer, phase, reopen, setPhase, showReady, start };
}

export function PlacementStep({
  actions,
  goalId,
  onDone,
  onFinishFailed,
  run,
  subject,
}: {
  actions: OnboardingActions;
  goalId: string;
  /** Saves the step and resolves whether it went through; a failure is this step's to say. */
  onDone: () => Promise<boolean>;
  /** Says a finish that didn't save, until the learner's next try. */
  onFinishFailed: (failed: boolean) => void;
  run: GenerationRun | null;
  subject: string;
}) {
  const { countAnswer, phase, reopen, setPhase, showReady, start } = useResumedPlacement({
    actions,
    goalId,
  });

  const [buildFailed, setBuildFailed] = useState(false);
  // Questions that arrived while the learner waited show once the wait moves on.
  const [questionsReady, setQuestionsReady] = useState<ReadyOutcome | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isStarting, startStarting] = useTransition();

  const finish = (fromScratch: boolean) =>
    startTransition(async () => {
      onFinishFailed(false);

      const { data: finished } = await safeAsync(() =>
        actions.finishPlacement({ fromScratch, goalId }),
      );

      // Finishing is one save to the learner: it goes through once the step's save does too.
      const saved = Boolean(finished) && (await onDone().catch(() => false));

      // `phase` is the screen the finish started on: a Stop on a question fails on that question's
      // line, counted with its answers; another screen's finish says so in the top notice.
      onFinishFailed(!saved && phase.kind !== "question");
      setPhase((current) => countSave({ current, from: phase, saved }));
    });

  const show = (outcome: PlacementOutcome) => {
    if (outcome.status === "failed") {
      throw new Error("Placement couldn't be read");
    }

    setBuildFailed(outcome.status === "generationFailed");

    if (outcome.status === "unavailable") {
      setPhase({ kind: "unavailable" });
    }

    if (outcome.status === "ready") {
      setQuestionsReady(outcome);
    }
  };

  // A run that failed or never started pauses checking until its "Try again" starts it over.
  const poll = usePoll({
    active: phase.kind === "waiting" && questionsReady === null && !isRunStopped(run),
    intervalMs: POLL_MS,
    onPoll: async () => show(await actions.getPlacement(goalId)),
  });

  const answer =
    (question: PlacementQuestion, answered: number) =>
    (choice: PlacementAnswer, durationMs: number) =>
      startTransition(async () => {
        onFinishFailed(false);

        const outcome = await actions
          .answerPlacement({ answer: choice, durationMs, goalId, itemId: question.itemId })
          .catch((): PlacementOutcome => ({ status: "failed" }));

        setPhase((current) =>
          countSave({ current, from: phase, saved: outcome.status !== "failed" }),
        );

        if (outcome.status === "failed") {
          return;
        }

        countAnswer(answered);

        if (outcome.status !== "ready") {
          setPhase({ kind: outcome.status === "unavailable" ? "unavailable" : "waiting" });
          return;
        }

        showReady(outcome);
      });

  switch (phase.kind) {
    case "loading":
      return <StepLoading />;
    case "loadFailed":
      return <StepLoadFailed onRetry={reopen} />;
    case "intro":
      return (
        <PlacementIntro
          onScratch={() => finish(true)}
          onStart={() => {
            onFinishFailed(false);
            startStarting(start);
          }}
          pending={isPending}
          starting={isStarting}
          subject={subject}
        />
      );
    case "waiting":
      return (
        <PlacementWaiting
          buildFailed={buildFailed}
          onQuestions={() => {
            if (questionsReady) {
              setQuestionsReady(null);
              showReady(questionsReady);
            }
          }}
          onSkip={() => finish(false)}
          poll={poll}
          questionsReady={questionsReady !== null}
          readWarmUp={actions.readWarmUp}
          run={run}
          skipping={isPending}
        />
      );
    case "unavailable":
      return <PlacementUnavailable onContinue={() => finish(false)} pending={isPending} />;
    case "question":
      return (
        <PlacementQuestionScreen
          failures={phase.failures}
          key={phase.question.itemId}
          number={phase.answered + 1}
          onAnswer={answer(phase.question, phase.answered)}
          onStop={() => finish(false)}
          pending={isPending}
          progress={phase.spent}
          question={phase.question}
          subject={subject}
          trueFalseLabels={phase.trueFalseLabels}
        />
      );
    case "done":
      return <PlacementDone onContinue={() => finish(false)} pending={isPending} />;
    default:
      return null;
  }
}
