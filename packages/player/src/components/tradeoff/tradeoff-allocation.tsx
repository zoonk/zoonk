"use client";

import { type TradeoffStepContent } from "@zoonk/core/steps/content-contract";
import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { Minus, Plus } from "lucide-react";
import { useExtracted } from "next-intl";
import { useCallback, useState } from "react";
import { type SelectedAnswer } from "../../player-reducer";
import { useReplaceName } from "../../user-name-context";
import { QuestionText } from "../question-text";
import { getEffectiveTokenTotal } from "./_utils/state-tier";
import { TradeoffEventBanner } from "./tradeoff-event-banner";
import { TradeoffStateLabel } from "./tradeoff-state-label";

/**
 * The allocation UI for a single tradeoff round.
 *
 * Displays priority rows with +/- stepper buttons for token distribution.
 * The learner must allocate ALL available tokens before the Check button
 * becomes enabled (via onSelectAnswer).
 *
 * Design: clean rows with subtle dividers, no bordered cards. Token counter
 * as plain text. Stepper buttons with 44px minimum touch targets.
 */
export function TradeoffAllocation({
  content,
  onSelectAnswer,
  priorityStates,
  roundNumber,
  stepId,
  totalRounds,
}: {
  content: TradeoffStepContent;
  onSelectAnswer: (stepId: string, answer: SelectedAnswer | null) => void;
  priorityStates: Record<string, number>;
  roundNumber: number;
  stepId: string;
  totalRounds: number;
}) {
  const t = useExtracted();
  const replaceName = useReplaceName();
  const effectiveTotal = getEffectiveTokenTotal(content);

  const [allocations, setAllocations] = useState<Record<string, number>>(() =>
    Object.fromEntries(content.priorities.map((priority) => [priority.id, 0])),
  );

  const allocated = Object.values(allocations).reduce((sum, value) => sum + value, 0);
  const remaining = effectiveTotal - allocated;
  const allSpent = remaining === 0;

  const handleChange = useCallback(
    (priorityId: string, delta: number) => {
      const current = allocations[priorityId] ?? 0;
      const next = current + delta;

      if (next < 0 || allocated + delta > effectiveTotal) {
        return;
      }

      const updated = { ...allocations, [priorityId]: next };
      const updatedTotal = allocated + delta;

      setAllocations(updated);

      if (updatedTotal === effectiveTotal) {
        onSelectAnswer(stepId, {
          allocations: content.priorities.map((priority) => ({
            priorityId: priority.id,
            tokens: updated[priority.id] ?? 0,
          })),
          kind: "tradeoff",
        });
      } else {
        onSelectAnswer(stepId, null);
      }
    },
    [allocated, allocations, content.priorities, effectiveTotal, onSelectAnswer, stepId],
  );

  const isFirstRound = roundNumber === 1;

  return (
    <div className="flex w-full flex-col gap-6">
      {!isFirstRound && <TradeoffEventBanner content={content} previousStates={priorityStates} />}

      {isFirstRound && content.priorities[0] && (
        <QuestionText>{replaceName(content.priorities[0].description)}</QuestionText>
      )}

      <div className="flex items-baseline justify-between">
        <p className="text-muted-foreground text-sm">
          {t("Round {current} of {total}", {
            current: String(roundNumber),
            total: String(totalRounds),
          })}
        </p>

        <p className="text-muted-foreground text-sm">
          {t("{allocated} of {total} {resource} allocated", {
            allocated: String(allocated),
            resource: content.resource.name,
            total: String(effectiveTotal),
          })}
        </p>
      </div>

      <div className="divide-border flex flex-col divide-y" role="group">
        {content.priorities.map((priority) => {
          const tokens = allocations[priority.id] ?? 0;
          const canDecrease = tokens > 0;
          const canIncrease = remaining > 0;
          const state = priorityStates[priority.id];

          return (
            <div className="flex items-center gap-4 py-4" key={priority.id}>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-base font-medium">{replaceName(priority.name)}</span>
                  {!isFirstRound && state !== undefined && (
                    <TradeoffStateLabel className="text-xs" state={state} />
                  )}
                </div>
                <span className="text-muted-foreground text-sm">
                  {replaceName(priority.description)}
                </span>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <Button
                  aria-label={t("Remove from {priority}", {
                    priority: priority.name,
                  })}
                  className="size-10"
                  disabled={!canDecrease}
                  onClick={() => handleChange(priority.id, -1)}
                  size="icon"
                  variant="outline"
                >
                  <Minus className="size-4" />
                </Button>

                <span
                  aria-label={t("{count} for {priority}", {
                    count: String(tokens),
                    priority: priority.name,
                  })}
                  className={cn(
                    "w-8 text-center text-lg font-semibold tabular-nums",
                    tokens === 0 && "text-muted-foreground",
                  )}
                >
                  {tokens}
                </span>

                <Button
                  aria-label={t("Add to {priority}", {
                    priority: priority.name,
                  })}
                  className="size-10"
                  disabled={!canIncrease}
                  onClick={() => handleChange(priority.id, 1)}
                  size="icon"
                  variant="outline"
                >
                  <Plus className="size-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {allSpent && (
        <p className="text-muted-foreground animate-in fade-in text-center text-sm duration-150">
          {t("All {resource} allocated. Tap Check to see what happens.", {
            resource: content.resource.name,
          })}
        </p>
      )}
    </div>
  );
}
