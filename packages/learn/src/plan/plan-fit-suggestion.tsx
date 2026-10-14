"use client";

import { useExtracted } from "next-intl";
import { SuggestionAction } from "../_components/suggestion";
import { useFormatGoalDate } from "../_utils/iso-date";
import { usePlanScreen } from "./plan-context";
import { useTimeEnough } from "./plan-coverage";
import { PlanOfferSuggestion } from "./plan-offer-suggestion";
import { type SlotItem, usePlanSuggestionSlot } from "./plan-suggestion-context";
import { useTopicsMovedSentence } from "./use-coverage-sentence";

/** How many topics the offer names before "and 3 more", so its line stays short. */
const NAMED_TOPICS = 2;

/**
 * The lessons the learner's own time fits that the plan doesn't hold (see `PlanView.fitOffer`),
 * at their time: "Your time covers everything by Oct 20" when it brings the rest of the goal in,
 * "3 more lessons fit in your time" when it brings in more depth, with the topics that come back
 * and the diff, then Apply or "Not now". Pedro, ahead of his dated plan with every lesson done, was
 * offered "10 min a day covers everything" beside his 15, and a won challenge added 4 lessons
 * behind his back; this is the one place what his time fits comes from.
 */
export function FitLessonsSuggestion({ item }: { item: SlotItem }) {
  const t = useExtracted();
  const formatGoalDate = useFormatGoalDate();
  const topicsMoved = useTopicsMovedSentence();
  const timeEnough = useTimeEnough();
  const { dismiss } = usePlanSuggestionSlot();
  const { plan } = usePlanScreen();
  const offer = plan.fitOffer;
  const { targetDate, targetDateNamedMonth } = plan.schedule;

  const title =
    timeEnough && targetDate
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
