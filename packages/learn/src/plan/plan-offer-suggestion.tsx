"use client";

import { type PlanOffer } from "@zoonk/core/plans/view-contract";
import { useExtracted } from "next-intl";
import { DoneMark } from "../_components/status-mark";
import {
  Suggestion,
  SuggestionAction,
  SuggestionActions,
  SuggestionDescription,
  SuggestionError,
  SuggestionHeader,
  SuggestionLine,
  SuggestionOpen,
  SuggestionResult,
  SuggestionSummary,
} from "../_components/suggestion";
import { PlanEffectDiff } from "../plan-diff/plan-effect-diff";
import {
  SlotContent,
  type SlotItem,
  SlotUndo,
  usePlanSuggestionSlot,
  useSlotAnswer,
  useSlotAnswered,
} from "./plan-suggestion-context";
import { useChangeSentence } from "./use-change-sentence";
import { usePlanChange } from "./use-plan-change";

/**
 * A change the Plan worked out before the learner sees it (see `PlanOffer`) as the slot's
 * suggestion: its title, what the diff can't say, the diff, then Apply beside the other ways on
 * (`actions`). Apply saves it, and the slot says "Plan updated" with what it did and Undo, in the
 * same place; Undo puts the offer back. Without an offer, only its words and the other ways on.
 */
export function PlanOfferSuggestion({
  actions,
  description,
  goalDate,
  item,
  mark,
  offer,
  title,
}: {
  /** The other ways on, after Apply: "Not now", or a menu of them. */
  actions: React.ReactNode;
  description: string[];
  /** The goal's own date the offer moves, from the one the plan has (see `PlanEffectDiff`). */
  goalDate?: { after: string; before: string | null };
  item: SlotItem;
  /** The kind's icon; the amber sparkle when absent. */
  mark?: React.ReactNode;
  offer: PlanOffer | null;
  title: string;
}) {
  const t = useExtracted();
  const sentence = useChangeSentence();
  const { change, failed, isPending } = usePlanChange();
  const { setResult } = usePlanSuggestionSlot();
  const answer = useSlotAnswer(item);
  const answered = useSlotAnswered(item);

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

  const undo = answer && <SlotUndo item={item} />;

  return (
    <Suggestion
      answered={answered}
      label={t("Plan suggestion")}
      mark={answer ? <DoneMark /> : mark}
    >
      <SuggestionLine>
        {answer ? (
          <>
            <SuggestionResult>{answer.text}</SuggestionResult>
            {undo}
          </>
        ) : (
          <>
            <SuggestionSummary>{title}</SuggestionSummary>
            <SuggestionOpen />
          </>
        )}
      </SuggestionLine>

      <SlotContent>
        <SuggestionHeader>{answer ? t("Plan updated") : title}</SuggestionHeader>

        {answer ? (
          <>
            <SuggestionResult>{answer.text}</SuggestionResult>
            <SuggestionActions>{undo}</SuggestionActions>
          </>
        ) : (
          <>
            {description.map((line) => (
              <SuggestionDescription key={line}>{line}</SuggestionDescription>
            ))}
            {offer && <PlanEffectDiff effect={offer.effect} goalDate={goalDate} />}

            <SuggestionActions>
              {offer && (
                <SuggestionAction disabled={isPending} onClick={apply}>
                  {t("Apply")}
                </SuggestionAction>
              )}
              {actions}
            </SuggestionActions>

            {failed && (
              <SuggestionError>{t("That didn't work. Try again in a moment.")}</SuggestionError>
            )}
          </>
        )}
      </SlotContent>
    </Suggestion>
  );
}
