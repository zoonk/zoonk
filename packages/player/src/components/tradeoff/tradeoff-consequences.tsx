"use client";

import { type TradeoffStepContent } from "@zoonk/core/steps/content-contract";
import { type SelectedAnswer } from "../../player-reducer";
import { useReplaceName } from "../../user-name-context";
import { getConsequenceTier } from "./_utils/get-consequence-tier";
import { CONSEQUENCE_STATE_DELTAS } from "./_utils/state-tier";
import { TradeoffStateLabel } from "./tradeoff-state-label";

const STAGGER_DELAY_MS = 150;

/**
 * Staggered consequence reveal shown during the feedback phase.
 *
 * Each priority's consequence animates in with a 150ms stagger delay,
 * creating anticipation as the learner watches their choices play out
 * one by one.
 *
 * The component reads the learner's allocation from the answer to
 * determine which tier (invested/maintained/neglected) to show.
 */
export function TradeoffConsequences({
  answer,
  content,
  currentStates,
}: {
  answer: SelectedAnswer | undefined;
  content: TradeoffStepContent;
  currentStates: Record<string, number>;
}) {
  const replaceName = useReplaceName();

  if (!answer || answer.kind !== "tradeoff") {
    return null;
  }

  const allocationMap = new Map(
    answer.allocations.map((allocation) => [allocation.priorityId, allocation.tokens]),
  );

  return (
    <div className="flex w-full flex-col gap-4">
      {content.outcomes.map((outcome, index) => {
        const priority = content.priorities.find(
          (candidate) => candidate.id === outcome.priorityId,
        );

        if (!priority) {
          return null;
        }

        const tokens = allocationMap.get(outcome.priorityId) ?? 0;
        const tier = getConsequenceTier(tokens);
        const delta = CONSEQUENCE_STATE_DELTAS[tier];
        const state = currentStates[outcome.priorityId] ?? 1;

        return (
          <div
            className="animate-in fade-in slide-in-from-bottom-1 fill-mode-backwards flex flex-col gap-1.5 py-3 duration-200 ease-out motion-reduce:animate-none"
            key={outcome.priorityId}
            style={{ animationDelay: `${index * STAGGER_DELAY_MS}ms` }}
          >
            <div className="flex items-center gap-2">
              <span className="text-base font-medium">{replaceName(priority.name)}</span>
              <TradeoffStateLabel delta={delta} state={state} />
            </div>

            <p className="text-muted-foreground text-sm leading-relaxed">
              {replaceName(outcome[tier].consequence)}
            </p>
          </div>
        );
      })}
    </div>
  );
}
