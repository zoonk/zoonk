"use client";

import { type PlanChangeView } from "@zoonk/core/plans/view-contract";
import { SuggestionDescription } from "../_components/suggestion";
import { useTopicsMovedSentence } from "../plan/use-coverage-sentence";

/**
 * The notice topics a change the learner didn't make moved into or out of the plan, as a line of
 * its notice: "Genetics no longer fits by your date." Covering less, or skipping lessons, names what
 * leaves and comes in; a card already long names fewer of them (`named`). Nothing when it moved
 * none.
 */
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
