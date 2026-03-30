"use client";

import { type TradeoffStepContent } from "@zoonk/core/steps/content-contract";
import { useExtracted } from "next-intl";
import { useReplaceName } from "../../user-name-context";
import { getEffectiveTokenTotal, getStateTier } from "./_utils/state-tier";
import { useStateTierLabel } from "./use-state-tier-label";

/**
 * Shown at the top of round 2+ allocation screens. Displays the
 * narrative event that changes the situation between rounds, along
 * with any state deltas and token changes.
 *
 * The event is the dramatic turn — it should land prominently so
 * the learner understands why the situation has changed.
 */
export function TradeoffEventBanner({
  content,
  previousStates,
}: {
  content: TradeoffStepContent;
  previousStates: Record<string, number>;
}) {
  const t = useExtracted();
  const replaceName = useReplaceName();
  const translateLabel = useStateTierLabel();

  if (!content.event) {
    return null;
  }

  const effectiveTotal = getEffectiveTokenTotal(content);
  const hasTokenChange =
    content.tokenOverride !== null && content.tokenOverride !== content.resource.total;

  return (
    <div className="mb-6 flex flex-col gap-3">
      <p className="text-base leading-relaxed font-medium">{replaceName(content.event)}</p>

      {content.stateModifiers && content.stateModifiers.length > 0 && (
        <div className="flex flex-col gap-1">
          {content.stateModifiers.map((modifier) => {
            const priority = content.priorities.find(
              (candidate) => candidate.id === modifier.priorityId,
            );

            if (!priority) {
              return null;
            }

            const previousState = previousStates[modifier.priorityId] ?? 1;
            const previousTier = getStateTier(previousState);
            const newState = previousState + modifier.delta;
            const newTier = getStateTier(newState);
            const sign = modifier.delta > 0 ? "+" : "";

            return (
              <p className="text-muted-foreground text-sm" key={modifier.priorityId}>
                {priority.name}:{" "}
                <span className={previousTier.colorClass}>
                  {translateLabel(previousTier.label)}
                </span>
                {" → "}
                <span className={newTier.colorClass}>
                  {translateLabel(newTier.label)} ({sign}
                  {modifier.delta})
                </span>
              </p>
            );
          })}
        </div>
      )}

      {hasTokenChange && (
        <p className="text-muted-foreground text-sm">
          {t("You now have {count} {resource}.", {
            count: String(effectiveTotal),
            resource: content.resource.name,
          })}
        </p>
      )}
    </div>
  );
}
