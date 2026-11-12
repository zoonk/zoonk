"use client";

import { useExtracted } from "next-intl";
import { SuggestionAction } from "../_components/suggestion";
import { usePlanScreen } from "./plan-context";
import { PlanOfferSuggestion } from "./plan-offer-suggestion";
import { type SlotItem, usePlanSuggestionSlot } from "./plan-suggestion-context";

export function FitLessonsSuggestion({ item }: { item: SlotItem }) {
  const t = useExtracted();
  const { dismiss } = usePlanSuggestionSlot();
  const { plan } = usePlanScreen();
  const offer = plan.fitOffer;

  return (
    <PlanOfferSuggestion
      accept={t("Add them")}
      actions={
        <SuggestionAction onClick={() => dismiss(item.key)} variant="outline">
          {t("Not now")}
        </SuggestionAction>
      }
      canApply={offer?.canApply ?? false}
      item={item}
      offer={offer}
      title={t(
        "{count, plural, one {# more lesson fits your time} other {# more lessons fit your time}}",
        { count: offer?.effect.lessonsAdded ?? 0 },
      )}
    />
  );
}
