"use client";

import { type TradeoffStepContent } from "@zoonk/core/steps/content-contract";
import { useExtracted } from "next-intl";
import { useReplaceName } from "../../user-name-context";
import { TradeoffStateLabel } from "./tradeoff-state-label";

const STAGGER_BASE_DELAY_MS = 600;
const STAGGER_DELAY_MS = 100;

/**
 * Summary of all priority final states, shown in the feedback phase
 * of the last tradeoff round.
 *
 * Uses staggered animation with a base delay so it appears after
 * the consequence reveal finishes.
 */
export function TradeoffFinalStates({
  content,
  finalStates,
}: {
  content: TradeoffStepContent;
  finalStates: Record<string, number>;
}) {
  const t = useExtracted();
  const replaceName = useReplaceName();

  return (
    <div className="mt-4 flex flex-col gap-3">
      <h3
        className="animate-in fade-in fill-mode-backwards text-sm font-medium duration-200"
        style={{ animationDelay: `${STAGGER_BASE_DELAY_MS}ms` }}
      >
        {t("Final state")}
      </h3>

      <div className="divide-border flex flex-col divide-y">
        {content.priorities.map((priority, index) => {
          const state = finalStates[priority.id] ?? 1;

          return (
            <div
              className="animate-in fade-in slide-in-from-bottom-1 fill-mode-backwards flex items-center justify-between py-3 duration-200 ease-out motion-reduce:animate-none"
              key={priority.id}
              style={{
                animationDelay: `${STAGGER_BASE_DELAY_MS + (index + 1) * STAGGER_DELAY_MS}ms`,
              }}
            >
              <span className="text-base font-medium">{replaceName(priority.name)}</span>
              <TradeoffStateLabel state={state} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
