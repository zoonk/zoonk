"use client";

import { type PlanOffer } from "@zoonk/core/plans/view-contract";
import { useExtracted } from "next-intl";
import {
  SuggestionAction,
  SuggestionActions,
  SuggestionDescription,
} from "../_components/suggestion";
import { PlanEffectDiff } from "../plan-diff/plan-effect-diff";
import {
  PlanChangeSuggestion,
  type SlotItem,
  usePlanSuggestionSlot,
} from "./plan-suggestion-context";
import { useChangeSentence } from "./use-change-sentence";
import { usePlanChange } from "./use-plan-change";

export function PlanOfferSuggestion({
  actions,
  canApply = true,
  description,
  item,
  offer,
  title,
}: {
  actions: React.ReactNode;
  canApply?: boolean;
  description: string[];
  item: SlotItem;
  offer: PlanOffer | null;
  title: string;
}) {
  const t = useExtracted();
  const sentence = useChangeSentence();
  const { change, failed, isPending } = usePlanChange();
  const { setResult } = usePlanSuggestionSlot();

  const apply = () => {
    if (!offer) {
      return;
    }

    void change(offer.operations, (outcome) => {
      if (outcome?.status === "applied") {
        setResult({
          change: outcome.change,
          item,
          text: outcome.change ? sentence(outcome.change) : t("Your plan is updated."),
        });
      }
    });
  };

  return (
    <PlanChangeSuggestion failed={failed} item={item} title={title}>
      {description.map((line) => (
        <SuggestionDescription key={line}>{line}</SuggestionDescription>
      ))}
      {offer && <PlanEffectDiff effect={offer.effect} />}

      <SuggestionActions>
        {offer && canApply && (
          <SuggestionAction disabled={isPending} onClick={apply}>
            {t("Apply")}
          </SuggestionAction>
        )}
        {actions}
      </SuggestionActions>
    </PlanChangeSuggestion>
  );
}
