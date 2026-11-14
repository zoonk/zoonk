"use client";

import { type PlanChangePreview } from "@zoonk/core/plans/preview-contract";
import { useExtracted } from "next-intl";
import { SuggestionAction, SuggestionActions } from "../_components/suggestion";
import { isSameEffect } from "../plan-diff/change-names";
import { PlanEffectDiff } from "../plan-diff/plan-effect-diff";
import { usePlanScreen } from "./plan-context";
import { OfferPreview, useApplyPreview } from "./plan-offer-preview";
import { currentPlanPreview } from "./plan-preview-state";
import {
  PlanChangeSuggestion,
  type SlotItem,
  usePlanSuggestionSlot,
} from "./plan-suggestion-context";
import { usePlanChangeSentence, usePlanDateKind } from "./use-change-sentence";
import { usePlanChange } from "./use-plan-change";

type FitOffer = NonNullable<ReturnType<typeof usePlanScreen>["plan"]["fitOffer"]>;

function useFitTitle() {
  const t = useExtracted();

  return (lessons: number) =>
    t(
      "{count, plural, one {You have time for # more lesson} other {You have time for # more lessons}}",
      { count: lessons },
    );
}

/**
 * The offer's numbers are the last plan write's. On a later day the tap checks today's first and
 * adds the lessons only when they are the ones on the card; otherwise the card shows today's.
 */
function useFitOffer({ item, offer }: { item: SlotItem; offer: FitOffer }) {
  const t = useExtracted();
  const sentence = usePlanChangeSentence();
  const { plan } = usePlanScreen();
  const { change, isPending } = usePlanChange();
  const slot = usePlanSuggestionSlot();
  const { apply: applyPreview, isPending: isApplying } = useApplyPreview(item);

  const preview = currentPlanPreview({ operations: offer.operations, plan, state: slot.preview });

  const add = () => {
    void change(offer.operations, (outcome) => {
      if (outcome?.status === "applied") {
        slot.setPreview();

        slot.setResult({
          change: outcome.change,
          item,
          text: outcome.change ? sentence(outcome.change) : t("Your plan is updated."),
        });
      }
    });
  };

  const isShown = (today: PlanChangePreview | null) =>
    today !== null && !today.unchanged && isSameEffect(today.effect, offer.effect);

  const accept = async () => {
    if (offer.canApply || isShown(await slot.requestPreview(offer.operations))) {
      add();
    }
  };

  return {
    accept: () => void accept(),
    applyPreview: () => applyPreview(preview),
    isPending: isPending || isApplying,
    preview,
    retry: () => void slot.requestPreview(offer.operations),
  };
}

function FitOfferSuggestion({ item, offer }: { item: SlotItem; offer: FitOffer }) {
  const t = useExtracted();
  const title = useFitTitle();
  const dateKind = usePlanDateKind();
  const { dismiss } = usePlanSuggestionSlot();
  const { accept, applyPreview, isPending, preview, retry } = useFitOffer({ item, offer });
  const today = preview.status === "ready" ? preview.preview.effect : null;

  return (
    <PlanChangeSuggestion item={item} title={title((today ?? offer.effect).lessonsAdded)}>
      {preview.status === "idle" ? (
        <>
          <PlanEffectDiff dateKind={dateKind} effect={offer.effect} said="lessonsAdded" />

          <SuggestionActions>
            <SuggestionAction onClick={() => dismiss(item.key)} variant="outline">
              {t("Not now")}
            </SuggestionAction>
            <SuggestionAction action={accept} busy={isPending}>
              {t("Add to my plan")}
            </SuggestionAction>
          </SuggestionActions>
        </>
      ) : (
        <OfferPreview
          onApply={applyPreview}
          onRetry={retry}
          pending={isPending}
          preview={preview}
          repriced
        />
      )}
    </PlanChangeSuggestion>
  );
}

export function FitLessonsSuggestion({ item }: { item: SlotItem }) {
  const { plan } = usePlanScreen();
  return plan.fitOffer && <FitOfferSuggestion item={item} offer={plan.fitOffer} />;
}
