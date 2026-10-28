"use client";

import { type PlanChangeView } from "@zoonk/core/plans/view-contract";
import { SuggestionDescription } from "../_components/suggestion";
import { useTopicsMovedSentence } from "../plan/use-coverage-sentence";

export function MovedTopicsLine({
  change,
  named,
}: {
  change: Pick<PlanChangeView, "effect">;
  named?: number;
}) {
  const sentence = useTopicsMovedSentence()(change, { named });
  return sentence ? <SuggestionDescription>{sentence}</SuggestionDescription> : null;
}
