"use client";

import { parseStepContent } from "@zoonk/core/steps/content-contract";
import { useMemo } from "react";
import { usePlayerRuntime } from "../../player-context";
import { type SelectedAnswer, type StepResult } from "../../player-reducer";
import { type SerializedStep } from "../../prepare-activity-data";
import { InteractiveStepLayout } from "../step-layouts";
import { computePriorityStates, getTradeoffRoundInfo } from "./_utils/compute-priority-states";
import { TradeoffAllocation } from "./tradeoff-allocation";
import { TradeoffConsequences } from "./tradeoff-consequences";
import { TradeoffFinalStates } from "./tradeoff-final-states";

/**
 * Main orchestrator for a single tradeoff round.
 *
 * Renders differently based on the player phase:
 * - **Playing**: allocation UI with stepper buttons (+ event banner for rounds 2+)
 * - **Feedback**: staggered consequence reveal (+ final state summary for last round)
 *
 * Each round is a separate step in the activity. State accumulates across
 * rounds by reading previous answers from the player state.
 */
export function TradeoffStep({
  onSelectAnswer,
  result,
  selectedAnswer,
  step,
}: {
  onSelectAnswer: (stepId: string, answer: SelectedAnswer | null) => void;
  result?: StepResult;
  selectedAnswer: SelectedAnswer | undefined;
  step: SerializedStep;
}) {
  const { state } = usePlayerRuntime();
  const content = useMemo(() => parseStepContent("tradeoff", step.content), [step.content]);
  const { isLastRound, roundNumber, totalRounds } = getTradeoffRoundInfo(state.steps, step.id);

  const hasResult = result !== undefined;

  /**
   * During allocation (playing phase): states BEFORE this round's allocation,
   * but AFTER this round's event modifiers — so the learner sees the event's
   * impact before deciding how to allocate.
   *
   * During consequences (feedback phase): states AFTER this round's allocation,
   * so consequence labels reflect the outcome of the learner's choices.
   */
  const priorityStates = useMemo(
    () =>
      computePriorityStates({
        allSteps: state.steps,
        currentStepId: step.id,
        includeCurrentRound: hasResult,
        selectedAnswers: state.selectedAnswers,
      }),
    [state.steps, step.id, hasResult, state.selectedAnswers],
  );

  return (
    <InteractiveStepLayout>
      {hasResult ? (
        <>
          <TradeoffConsequences
            answer={selectedAnswer}
            content={content}
            currentStates={priorityStates}
          />
          {isLastRound && <TradeoffFinalStates content={content} finalStates={priorityStates} />}
        </>
      ) : (
        <TradeoffAllocation
          content={content}
          onSelectAnswer={onSelectAnswer}
          priorityStates={priorityStates}
          roundNumber={roundNumber}
          stepId={step.id}
          totalRounds={totalRounds}
        />
      )}
    </InteractiveStepLayout>
  );
}
