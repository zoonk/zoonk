"use client";

import { type TrueFalseLabels } from "@zoonk/core/library/exams/true-false-labels";
import { useRef, useState, useTransition } from "react";
import { usePoll } from "../../_utils/use-poll";
import { type GenerationRun } from "../../generation/generation-run";
import { useLearnAnalytics } from "../../learn-context";
import {
  type OnboardingActions,
  type PlacementAnswer,
  type PlacementMockOutcome,
  type PlacementOutcome,
  type PlacementQuestion,
} from "../onboarding-actions";
import { PlacementQuestionScreen } from "./placement-question";
import {
  PlacementDone,
  PlacementIntro,
  PlacementMockRunning,
  PlacementUnavailable,
} from "./placement-screens";
import { PlacementWaiting } from "./placement-waiting";
import { StepLoading } from "./step-parts";
import { rememberStepStart, wasStepStarted } from "./step-started";
import { useReadOnOpen } from "./use-read-on-open";
import { isRunStopped } from "./wait-run";

const POLL_MS = 3000;

type ReadyOutcome = Extract<PlacementOutcome, { status: "ready" }>;

type Phase =
  | { answered: number; forToday: boolean; fromMock?: boolean; kind: "done" }
  | { kind: "mockRunning"; mockId: string }
  | { kind: "intro" | "loading" | "unavailable" | "waiting" }
  | {
      answered: number;
      kind: "question";
      question: PlacementQuestion;
      /** 0 to 1. */
      spent: number;
      trueFalseLabels: TrueFalseLabels;
    };

/** The server's counts can shrink while the plan is still being written, and neither a question's number nor the bar goes back. */
type Shown = { answered: number; spent: number };

const NOTHING_SHOWN: Shown = { answered: 0, spent: 0 };

function toPhase(outcome: ReadyOutcome, shown: Shown = NOTHING_SHOWN): Phase {
  const answered = Math.max(outcome.answered, shown.answered);

  return outcome.next && !outcome.complete
    ? {
        answered,
        kind: "question",
        question: outcome.next,
        spent: Math.max(outcome.dayBudgetSpent, shown.spent),
        trueFalseLabels: outcome.trueFalseLabels,
      }
    : { answered, forToday: outcome.dayBudgetUsed, kind: "done" };
}

function toResumedPhase({
  mock,
  outcome,
  tapped,
}: {
  mock: PlacementMockOutcome["mock"];
  outcome: PlacementOutcome;
  tapped: boolean;
}): Phase {
  if (mock?.status === "running") {
    return { kind: "mockRunning", mockId: mock.id };
  }

  if (mock?.status === "finished") {
    const answered = outcome.status === "ready" ? outcome.answered : 0;
    return { answered, forToday: false, fromMock: true, kind: "done" };
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
  const [mockOffer, setMockOffer] = useState<PlacementMockOutcome["offer"]>(null);
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

  useReadOnOpen({
    onRead: (read) => {
      setMockOffer(read?.mock.offer ?? null);

      showPhase(
        toResumedPhase({
          mock: read?.mock.mock ?? null,
          outcome: read?.outcome ?? { status: "failed" },
          tapped: wasStepStarted({ goalId, step: "placement" }),
        }),
      );
    },
    read: async () => {
      const [outcome, mock] = await Promise.all([
        actions.getPlacement(goalId),
        actions.getPlacementMock(goalId),
      ]);

      return { mock, outcome };
    },
  });

  return { countAnswer, mockOffer, phase, setPhase, showReady };
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

export function PlacementStep({
  actions,
  areaCount,
  goalId,
  mockHrefs,
  onDone,
  run,
  subject,
}: {
  actions: OnboardingActions;
  areaCount: number;
  goalId: string;
  mockHrefs: { mock: (mockId: string) => string; start: string };
  onDone: () => void;
  run: GenerationRun | null;
  subject: string;
}) {
  const analytics = useLearnAnalytics();

  const { countAnswer, mockOffer, phase, setPhase, showReady } = useResumedPlacement({
    actions,
    goalId,
  });

  const [buildFailed, setBuildFailed] = useState(false);
  const [answerFailed, setAnswerFailed] = useState(false);
  const [isPending, startTransition] = useTransition();

  const finish = (fromScratch: boolean, stopMockId: string | null = null) =>
    startTransition(async () => {
      if (stopMockId) {
        await actions.stopPlacementMock(stopMockId);
      }

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
      showReady(outcome);
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

        countAnswer(answered);

        if (outcome.status !== "ready") {
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

        showReady(outcome);
      });

  switch (phase.kind) {
    case "loading":
      return <StepLoading />;
    case "intro":
      return (
        <PlacementIntro
          areaCount={areaCount}
          mock={mockOffer && { ...mockOffer, href: mockHrefs.start }}
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
          failed={answerFailed}
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
    case "mockRunning":
      return (
        <PlacementMockRunning
          href={mockHrefs.mock(phase.mockId)}
          onStop={() => finish(false, phase.mockId)}
          pending={isPending}
        />
      );
    case "done":
      return (
        <PlacementDone
          answered={phase.answered}
          forToday={phase.forToday}
          fromMock={phase.fromMock ?? false}
          onContinue={() => finish(false)}
          pending={isPending}
        />
      );
    default:
      return null;
  }
}
