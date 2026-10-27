"use client";

import { useExtracted } from "next-intl";
import { SuggestionAction } from "../_components/suggestion";
import { useFormatGoalDate } from "../_utils/iso-date";
import { usePlanScreen } from "./plan-context";
import { PlanOfferSuggestion } from "./plan-offer-suggestion";
import { type SlotItem, usePlanSuggestionSlot } from "./plan-suggestion-context";
import { useTopicsMovedSentence } from "./use-coverage-sentence";

/** How many topics the offer names before "and 3 more", so its line stays short. */
const NAMED_TOPICS = 2;

/**
 * The lessons the learner's own time fits that the plan doesn't hold (see `PlanView.fitOffer`),
 * at their time: "Your time covers everything by Oct 20" when the change it plans brings the rest
 * of the goal in (its own result, so the title and the diff come from one plan),
 * "3 more lessons fit in your time" when it brings in more depth, with the topics that come back
 * and the diff, then Apply or "Not now". This is the one place what the learner's time fits comes
 * from.
 */
export function FitLessonsSuggestion({ item }: { item: SlotItem }) {
  const t = useExtracted();
  const formatGoalDate = useFormatGoalDate();
  const topicsMoved = useTopicsMovedSentence();
  const { dismiss } = usePlanSuggestionSlot();
  const { plan } = usePlanScreen();
  const offer = plan.fitOffer;
  const { targetDate, targetDateNamedMonth } = plan.schedule;

  const title =
    offer?.fits && targetDate
      ? t("Your time covers everything by {date}", {
          date: formatGoalDate({
            isoDate: targetDate,
            namedMonth: targetDateNamedMonth,
            style: "long",
          }),
        })
      : t(
          "{count, plural, one {# more lesson fits in your time} other {# more lessons fit in your time}}",
          { count: offer?.effect.lessonsAdded ?? 0 },
        );

  const topics = offer && topicsMoved(offer, { named: NAMED_TOPICS });

  return (
    <PlanOfferSuggestion
      actions={
        <SuggestionAction onClick={() => dismiss(item.key)} variant="outline">
          {t("Not now")}
        </SuggestionAction>
      }
      description={topics ? [topics] : []}
      item={item}
      offer={offer}
      title={title}
    />
  );
}
