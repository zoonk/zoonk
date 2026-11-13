"use client";

import { type PlanOffer } from "@zoonk/core/plans/view-contract";
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
  said,
  title,
}: {
  /** The offer's own verb, such as "Add to my plan". */
  accept: string;
  actions: React.ReactNode;
  canApply?: boolean;
  item: SlotItem;
  offer: PlanOffer | null;
  /** What the title already states. */
  said?: "lessonsAdded";
  title: string;
}) {
  const t = useExtracted();
  const sentence = usePlanChangeSentence();
  const { change, isPending } = usePlanChange();
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
    <PlanChangeSuggestion item={item} title={title}>
      {offer && <PlanEffectDiff effect={offer.effect} said={said} />}

      <SuggestionActions>
        {offer && canApply && (
          <SuggestionAction action={apply} busy={isPending}>
            {accept}
          </SuggestionAction>
        )}
        {actions}
      </SuggestionActions>
    </PlanChangeSuggestion>
  );
}
