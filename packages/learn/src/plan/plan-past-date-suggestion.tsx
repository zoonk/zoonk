"use client";

import { type PlanView } from "@zoonk/core/plans/view-contract";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@zoonk/ui/components/dropdown-menu";
import { CalendarClockIcon, ChevronDownIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { SuggestionAction } from "../_components/suggestion";
import { useFormatGoalDate, useFormatIsoDate } from "../_utils/iso-date";
import { useFormatDuration } from "../_utils/time-format";
import { usePlanScreen } from "./plan-context";
import { PlanOfferSuggestion } from "./plan-offer-suggestion";
import { usePastDateText } from "./plan-status-label";
import { type SlotItem, usePlanSuggestionSlot } from "./plan-suggestion-context";

type Offer = NonNullable<PlanView["pastDateOffer"]>;

/**
 * What the offer does, over its diff, in the words studying everything and the coverage
 * suggestion use, since the plan then covers everything, what its date had cut included (its diff
 * can add more lessons than were left): a goal's own date moves to the day the learner's time
 * covers everything by; an exam's stays, and every topic comes after it, with when they'd finish.
 * Empty without an offer: the way on is the plan editor.
 */
function useOfferText() {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();
  const formatGoalDate = useFormatGoalDate();
  const formatDuration = useFormatDuration();
  const { plan } = usePlanScreen();
  const { dailyMinutes, targetDate, targetDateNamedMonth } = plan.schedule;

  return function offerText(offer: Offer | null): string[] {
    const [operation] = offer?.operations ?? [];
    const end = offer?.effect.endDateAfter;

    if (operation?.kind === "setTargetDate" && operation.targetDate) {
      return [
        t("Your time covers everything by {date}", {
          date: formatDate(operation.targetDate, "long"),
        }),
      ];
    }

    if (operation?.kind !== "setFullCourse" || !end || !targetDate) {
      return [];
    }

    return [
      t("Every topic, even after the exam, at your own pace."),
      t("At {time} a day, you finish in {month}, after the exam on {date}.", {
        date: formatGoalDate({
          isoDate: targetDate,
          namedMonth: targetDateNamedMonth,
          style: "longYear",
        }),
        month: formatDate(end, "month"),
        time: formatDuration(dailyMinutes),
      }),
    ];
  };
}

/** The goal's own date the offer moves, from the one the plan has; none for an exam's. */
function useGoalDateMove() {
  const { plan } = usePlanScreen();

  return (offer: Offer) => {
    const [operation] = offer.operations;

    return operation?.kind === "setTargetDate" && operation.targetDate
      ? { after: operation.targetDate, before: plan.schedule.targetDate }
      : undefined;
  };
}

/**
 * The other ways on: the plan editor at its date (another date, an exam's next sitting), and "Not
 * now", which leaves the suggestion out until the Plan opens again.
 */
function OtherOptions({ item }: { item: SlotItem }) {
  const t = useExtracted();
  const { dismiss, host } = usePlanSuggestionSlot();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<SuggestionAction variant="outline" />}>
        {t("Other options")}
        <ChevronDownIcon aria-hidden="true" data-icon="inline-end" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuItem onClick={() => host.onEdit("date")}>{t("Adjust plan")}</DropdownMenuItem>
        <DropdownMenuItem onClick={() => dismiss(item.key)}>{t("Not now")}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * The plan's date came with lessons left (status `pastDate`): the plan doesn't end. The slot says
 * how many lessons are left and offers the one change that keeps the plan going (see
 * `PlanView.pastDateOffer`), worked out before the learner sees it, so its diff shows at once and
 * Apply is one tap (see `PlanOfferSuggestion`): their own date moves to the day their time covers
 * what's left by, or an exam's plan goes on after the exam, whose date is fixed. Lucas, a day past
 * his date, read "Your plan ended · 13 lessons were left out" and was offered the course's next
 * level. Without an offer, the way on is the plan editor at its date.
 */
export function PastDateSuggestion({ item }: { item: Extract<SlotItem, { kind: "pastDate" }> }) {
  const t = useExtracted();
  const pastDateText = usePastDateText();
  const offerText = useOfferText();
  const getGoalDateMove = useGoalDateMove();
  const { goal, plan } = usePlanScreen();
  const { dismiss, host } = usePlanSuggestionSlot();
  const offer = plan.pastDateOffer;
  const { title } = pastDateText({ isExam: goal.kind === "exam", lessons: item.lessons });

  const actions = offer ? (
    <OtherOptions item={item} />
  ) : (
    <>
      <SuggestionAction onClick={() => host.onEdit("date")}>{t("Adjust plan")}</SuggestionAction>
      <SuggestionAction onClick={() => dismiss(item.key)} variant="outline">
        {t("Not now")}
      </SuggestionAction>
    </>
  );

  return (
    <PlanOfferSuggestion
      actions={actions}
      description={offerText(offer)}
      goalDate={offer ? getGoalDateMove(offer) : undefined}
      item={item}
      mark={<CalendarClockIcon />}
      offer={offer}
      title={title}
    />
  );
}
