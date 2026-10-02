"use client";

import { type TrueFalseLabels } from "@zoonk/core/library/exams/true-false-labels";
import { useExtracted } from "next-intl";
import { useState, useTransition } from "react";
import { usePoll } from "../../_utils/use-poll";
import { type GenerationRun } from "../../generation/generation-run";
import { useLearnAnalytics } from "../../learn-context";
import {
  type OnboardingActions,
  type PlacementAnswer,
  type PlacementOutcome,
  type PlacementQuestion,
} from "../onboarding-actions";
import { PlacementQuestionScreen } from "./placement-question";
import { PlacementDone, PlacementIntro, PlacementUnavailable } from "./placement-screens";
import { PlacementWaiting } from "./placement-waiting";
import { StepLoading } from "./step-parts";
import { rememberStepStart, wasStepStarted } from "./step-started";
import { useReadOnOpen } from "./use-read-on-open";
import { isRunStopped } from "./wait-run";

/** Questions come from the goal's skill map, which is still being drawn right after the goal. */
const POLL_MS = 3000;

type ReadyOutcome = Extract<PlacementOutcome, { status: "ready" }>;

type Phase =
  /** `forToday`: the day's few minutes are used and the first sessions ask the rest. */
  | { answered: number; forToday: boolean; kind: "done" }
  | { kind: "intro" | "loading" | "unavailable" | "waiting" }
  | {
      answered: number;
      kind: "question";
      question: PlacementQuestion;
      trueFalseLabels: TrueFalseLabels;
    };

/**
 * A new question while placement still needs one, the starting point once it's settled or once
 * today's few minutes are used.
 */
function toPhase(outcome: ReadyOutcome): Phase {
  return outcome.next && !outcome.complete
    ? {
        answered: outcome.answered,
        kind: "question",
        question: outcome.next,
        trueFalseLabels: outcome.trueFalseLabels,
      }
    : { answered: outcome.answered, forToday: outcome.dayBudgetUsed, kind: "done" };
}

/**
 * Where placement was before a refresh, once the learner tapped Start in this tab: its next
 * question from what's saved, or the wait. Otherwise its start, even when earlier answers on the
 * same skills (from another goal) already count, so the learner still sees what it is.
 */
function toResumedPhase({
  outcome,
  started,
}: {
  outcome: PlacementOutcome | null;
  started: boolean;
}): Phase {
  if (outcome?.status === "ready" && started) {
    return toPhase(outcome);
  }

  if (!started) {
    return { kind: "intro" };
  }

  return outcome?.status === "unavailable" ? { kind: "unavailable" } : { kind: "waiting" };
}

function getAnswerKind({
  choice,
  isCorrect,
}: {
  choice: PlacementAnswer;
  isCorrect: boolean | null;
}): "correct" | "dont_know" | "incorrect" {
  if ("dontKnow" in choice) {
    return "dont_know";
  }

  return isCorrect ? "correct" : "incorrect";
}

/**
 * Placement while the first lessons are made: adaptive questions from the goal's skill map, with
 * "I don't know yet" welcome and no score. It ends when every area of every phase has a starting
 * point, when nothing more can be asked today, or whenever the learner stops; "start from
 * scratch" skips it. While the skill map or the next questions are being made, it follows the
 * goal's run (`run`) and checks for questions until they come, and says so when they can't.
 */
export function PlacementStep({
  actions,
  examSubjects,
  goalId,
  onDone,
  run,
  subject,
}: {
  actions: OnboardingActions;
  /** An exam's subjects, shown as tiles before placement starts. */
  examSubjects: string[];
  goalId: string;
  onDone: () => void;
  /** The run building the goal's skill map and questions, when the host follows it. */
  run: GenerationRun | null;
  subject: string;
}) {
  const t = useExtracted();
  const analytics = useLearnAnalytics();
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [buildFailed, setBuildFailed] = useState(false);
  const [answerFailed, setAnswerFailed] = useState(false);
  const [isPending, startTransition] = useTransition();

  // A refresh comes back to where placement was, from what's saved; a first visit to its start.
  useReadOnOpen({
    onRead: (outcome) =>
      setPhase(toResumedPhase({ outcome, started: wasStepStarted({ goalId, step: "placement" }) })),
    read: async () =>
      wasStepStarted({ goalId, step: "placement" }) ? actions.getPlacement(goalId) : null,
  });

  const finish = (fromScratch: boolean) =>
    startTransition(async () => {
      await actions.finishPlacement({ fromScratch, goalId });
      onDone();
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
      setPhase(toPhase(outcome));
    }
  };

  // A run that failed or never started pauses checking until its "Try again" starts it over.
  const poll = usePoll({
    active: phase.kind === "waiting" && !isRunStopped(run),
    intervalMs: POLL_MS,
    onPoll: async () => show(await actions.getPlacement(goalId)),
  });

  const start = () => {
    rememberStepStart({ goalId, step: "placement" });
    setPhase({ kind: "waiting" });
  };

  const answer =
    (question: PlacementQuestion, answered: number) =>
    (choice: PlacementAnswer, durationMs: number) =>
      startTransition(async () => {
        const outcome = await actions.answerPlacement({
          answer: choice,
          durationMs,
          goalId,
          itemId: question.itemId,
        });

        setAnswerFailed(outcome.status === "failed");

        if (outcome.status === "failed") {
          return;
        }

        if (outcome.status !== "ready") {
          // The next questions are still being written: wait for them instead of repeating one.
          setPhase({ kind: outcome.status === "unavailable" ? "unavailable" : "waiting" });
          return;
        }

        analytics.track({
          name: "Placement Answered",
          properties: {
            answer: getAnswerKind({ choice, isCorrect: outcome.isCorrect }),
            question_number: answered + 1,
            skill_id: question.skillId,
          },
        });

        setPhase(toPhase(outcome));
      });

  switch (phase.kind) {
    case "loading":
      return <StepLoading />;
    case "intro":
      return (
        <PlacementIntro
          examSubjects={examSubjects}
          onScratch={() => finish(true)}
          onStart={start}
          pending={isPending}
          subject={subject}
        />
      );
    case "waiting":
      return (
        <PlacementWaiting
          buildFailed={buildFailed}
          onSkip={() => finish(false)}
          poll={poll}
          run={run}
          skipping={isPending}
        />
      );
    case "unavailable":
      return <PlacementUnavailable onContinue={() => finish(false)} pending={isPending} />;
    case "question":
      return (
        <PlacementQuestionScreen
          error={answerFailed ? t("We couldn't save your answer. Try again.") : null}
          key={phase.question.itemId}
          number={phase.answered + 1}
          onAnswer={answer(phase.question, phase.answered)}
          onStop={() => finish(false)}
          pending={isPending}
          question={phase.question}
          subject={subject}
          trueFalseLabels={phase.trueFalseLabels}
        />
      );
    case "done":
      return (
        <PlacementDone
          answered={phase.answered}
          forToday={phase.forToday}
          onContinue={() => finish(false)}
          pending={isPending}
        />
      );
    default:
      return null;
  }
}
