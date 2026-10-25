"use client";

import { type TrueFalseLabels } from "@zoonk/core/library/exams/true-false-labels";
import { useExtracted } from "next-intl";
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

/** Questions come from the goal's skill map, which is still being drawn right after the goal. */
const POLL_MS = 3000;

type ReadyOutcome = Extract<PlacementOutcome, { status: "ready" }>;

type Phase =
  /**
   * `forToday`: the day's few minutes are used and the first sessions ask the rest. `fromMock`:
   * the learner took the whole exam as a mock instead, and it set the starting point.
   */
  | { answered: number; forToday: boolean; fromMock?: boolean; kind: "done" }
  /** The whole exam taken as a mock instead, left running: go on with it or stop here. */
  | { kind: "mockRunning"; mockId: string }
  | { kind: "intro" | "loading" | "unavailable" | "waiting" }
  | {
      answered: number;
      kind: "question";
      question: PlacementQuestion;
      /** How far along today's questions are at most, from 0 to 1 (`dayBudgetSpent`). */
      spent: number;
      trueFalseLabels: TrueFalseLabels;
    };

/**
 * How far this screen already showed placement: the server counts this placement's answers on the
 * plan's current skills, which can shrink while the plan is still being written, and neither a
 * question's number nor the bar ever goes back.
 */
type Shown = { answered: number; spent: number };

const NOTHING_SHOWN: Shown = { answered: 0, spent: 0 };

/**
 * A new question while placement still needs one, the starting point once it's settled or once
 * today's few minutes are used.
 */
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

/**
 * Where placement was when the learner comes back: its next question once this goal's placement
 * has answers (saved on the server, so another tab or device resumes too), or once they tapped
 * Start in this tab, else the wait for its questions. Otherwise its start, even when earlier
 * answers on the same skills (from another goal) already count, so the learner sees what it is.
 */
function toResumedPhase({
  mock,
  outcome,
  tapped,
}: {
  /** The goal's placement mock, when the learner took the whole exam instead. */
  mock: PlacementMockOutcome["mock"];
  outcome: PlacementOutcome;
  /** The learner tapped Start in this tab, before any answer was saved. */
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

/**
 * Coming back returns to where placement was, from what's saved (the placement mock included); a
 * first visit to its start. It also reads whether the whole exam can be taken as a mock instead.
 */
function useResumedPlacement({ actions, goalId }: { actions: OnboardingActions; goalId: string }) {
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [mockOffer, setMockOffer] = useState<PlacementMockOutcome["offer"]>(null);
  // What this screen showed, so the next question's number and the bar never go back (`Shown`).
  const shown = useRef(NOTHING_SHOWN);

  /** The phase an outcome leads to, never behind what this screen already showed. */
  const showReady = (outcome: ReadyOutcome) => {
    const next = toPhase(outcome, shown.current);

    if (next.kind === "question") {
      shown.current = { answered: shown.current.answered, spent: next.spent };
    }

    setPhase(next);
  };

  /** An answer given on this screen to the question numbered after `answered`. */
  const countAnswer = (answered: number) => {
    shown.current = {
      answered: Math.max(shown.current.answered, answered + 1),
      spent: shown.current.spent,
    };
  };

  useReadOnOpen({
    onRead: (read) => {
      setMockOffer(read?.mock.offer ?? null);

      setPhase(
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

/**
 * Placement while the first lessons are made: adaptive questions from the goal's skill map, with
 * "I don't know yet" welcome and no score, or for an exam (accounts only), the whole exam as a
 * mock, whose answers set the starting point; stopping it midway keeps them. It ends when every
 * area of every phase has a starting point, when nothing more can be asked today, or whenever the
 * learner stops; "start from scratch" skips it. While the skill map or the next questions are being made, it follows the
 * goal's run (`run`) and checks for questions until they come, and says so when they can't.
 */
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
  /** How many areas an exam's placement asks about; 0 for other goals. */
  areaCount: number;
  goalId: string;
  /** The whole exam as a mock instead (`start`), and a running mock by its id. */
  mockHrefs: { mock: (mockId: string) => string; start: string };
  onDone: () => void;
  /** The run building the goal's skill map and questions, when the host follows it. */
  run: GenerationRun | null;
  subject: string;
}) {
  const t = useExtracted();
  const analytics = useLearnAnalytics();

  const { countAnswer, mockOffer, phase, setPhase, showReady } = useResumedPlacement({
    actions,
    goalId,
  });

  const [buildFailed, setBuildFailed] = useState(false);
  const [answerFailed, setAnswerFailed] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Stopping a placement mock first keeps what was answered, which sets where the plan starts.
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
          error={answerFailed ? t("We couldn't save your answer. Try again.") : null}
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
