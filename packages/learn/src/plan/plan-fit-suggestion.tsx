"use client";

import { type PlanChangePreview } from "@zoonk/core/plans/preview-contract";
import { useExtracted } from "next-intl";
import {
  SuggestionAction,
  SuggestionActions,
  SuggestionDescription,
} from "../_components/suggestion";
import { FactSegments } from "../_components/task-meta";
import { isSameEffect } from "../plan-diff/change-names";
import { PlanEffectDiff } from "../plan-diff/plan-effect-diff";
import { useExtraLabel } from "../syllabus/use-extra-label";
import { usePlanScreen } from "./plan-context";
import { OfferPreview, useApplyPreview } from "./plan-offer-preview";
import { type PlanPreviewState, currentPlanPreview } from "./plan-preview-state";
import {
  PlanChangeSuggestion,
  type SlotItem,
  usePlanSuggestionSlot,
} from "./plan-suggestion-context";
import { usePlanChangeSentence, usePlanDateKind } from "./use-change-sentence";
import { usePlanChange } from "./use-plan-change";

type FitItem = Extract<SlotItem, { kind: "fitLessons" }>;
type ExtraItem = Extract<SlotItem, { kind: "extraLessons" }>;
type Offer = Pick<FitItem["offer"], "canApply" | "effect" | "operations">;

/**
 * The offer's numbers are the last plan write's. On a later day the tap checks today's first and
 * adds the lessons only when they are the ones on the card; otherwise the card shows today's. A
 * check that matches leaves the card as it is, and Try again is the same tap again.
 */
function usePlanOffer({ item, offer }: { item: SlotItem; offer: Offer }) {
  const t = useExtracted();
  const sentence = usePlanChangeSentence();
  const { actions, plan } = usePlanScreen();
  const { change, isPending } = usePlanChange({ offer: true });
  const slot = usePlanSuggestionSlot();
  const { apply: applyPreview, isPending: isApplying } = useApplyPreview(item);

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

  const checked = currentPlanPreview({ operations: offer.operations, plan, state: slot.preview });

  // A plan that already holds the offer is read again, and the card leaves with the offer.
  const preview: PlanPreviewState =
    checked.status === "ready" && (checked.preview.unchanged || isShown(checked.preview))
      ? { status: "idle" }
      : checked;

  const accept = async () => {
    if (offer.canApply) {
      add();
      return;
    }

    const today = await slot.requestPreview(offer.operations);

    if (today?.ready && today.unchanged) {
      actions.readPlanAgain();
    } else if (isShown(today)) {
      add();
    }
  };

  return {
    accept: () => void accept(),
    applyPreview: () => applyPreview(preview),
    isPending: isPending || isApplying,
    preview,
  };
}

/** An offer to add lessons: what it adds, Add to plan and Not now, or today's numbers once they differ. */
function OfferSuggestion({
  children,
  item,
  offer,
  title,
}: {
  children: React.ReactNode;
  item: SlotItem;
  offer: Offer;
  title: (effect: Offer["effect"]) => string;
}) {
  const t = useExtracted();
  const { dismiss } = usePlanSuggestionSlot();
  const { accept, applyPreview, isPending, preview } = usePlanOffer({ item, offer });
  const today = preview.status === "ready" ? preview.preview.effect : null;

  return (
    <PlanChangeSuggestion item={item} title={title(today ?? offer.effect)}>
      {preview.status === "idle" ? (
        <>
          {children}

          <SuggestionActions
            main={
              <SuggestionAction action={accept} busy={isPending}>
                {t("Add to plan")}
              </SuggestionAction>
            }
          >
            <SuggestionAction onClick={() => dismiss(item.key)} variant="outline">
              {t("Not now")}
            </SuggestionAction>
          </SuggestionActions>
        </>
      ) : (
        <OfferPreview
          onApply={applyPreview}
          onRetry={accept}
          pending={isPending}
          preview={preview}
          repriced
        />
      )}
    </PlanChangeSuggestion>
  );
}

export function FitLessonsSuggestion({ item }: { item: FitItem }) {
  const t = useExtracted();
  const dateKind = usePlanDateKind();

  const title = (effect: Offer["effect"]) =>
    t(
      "{count, plural, one {You have time for # more lesson} other {You have time for # more lessons}}",
      { count: effect.lessonsAdded },
    );

  return (
    <OfferSuggestion item={item} offer={item.offer} title={title}>
      <PlanEffectDiff dateKind={dateKind} effect={item.offer.effect} said="lessonsAdded" />
    </OfferSuggestion>
  );
}

export function ExtraLessonsSuggestion({ item }: { item: ExtraItem }) {
  const t = useExtracted();
  const extraLabel = useExtraLabel();
  const { plan } = usePlanScreen();

  return (
    <OfferSuggestion item={item} offer={item.offer} title={() => t("Study exam strategy too?")}>
      <SuggestionDescription>
        <FactSegments
          facts={[
            t("{count, plural, one {# lesson} other {# lessons}}", { count: item.offer.lessons }),
            extraLabel({ document: plan.examDocument, hasNotice: Boolean(plan.hasNotice) }),
          ]}
        />
      </SuggestionDescription>
    </OfferSuggestion>
  );
}
