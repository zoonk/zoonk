"use client";

import { type PlanOffer } from "@zoonk/core/plans/view-contract";
import { CheckIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { SuggestionAction, SuggestionActions } from "../_components/suggestion";
import { PlanEffectDiff } from "../plan-diff/plan-effect-diff";
import {
  PlanChangeSuggestion,
  type SlotItem,
  usePlanSuggestionSlot,
} from "./plan-suggestion-context";
import { usePlanChangeSentence } from "./use-change-sentence";
import { usePlanChange } from "./use-plan-change";

export function PlanOfferSuggestion({
  accept,
  actions,
  canApply = true,
  item,
  offer,
  title,
}: {
  /** The offer's own verb, such as "Add them". */
  accept: string;
  actions: React.ReactNode;
  canApply?: boolean;
  item: SlotItem;
  offer: PlanOffer | null;
  title: string;
}) {
  const t = useExtracted();
  const sentence = usePlanChangeSentence();
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
      {offer && <PlanEffectDiff effect={offer.effect} />}

      <SuggestionActions>
        {offer && canApply && (
          <SuggestionAction action={apply} busy={isPending} icon={<CheckIcon aria-hidden="true" />}>
            {accept}
          </SuggestionAction>
        )}
        {actions}
      </SuggestionActions>
    </PlanChangeSuggestion>
  );
}
