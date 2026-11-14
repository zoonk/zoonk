"use client";

import { type LearnerPlanOperation } from "@zoonk/core/plans/contract";
import { DropdownMenuItem } from "@zoonk/ui/components/dropdown-menu";
import { CalendarClockIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useRef, useState } from "react";
import {
  SuggestionAction,
  SuggestionActions,
  SuggestionDescription,
} from "../_components/suggestion";
import { SuggestionMenu } from "../_components/suggestion-menu";
import { useFormatIsoDate } from "../_utils/iso-date";
import { usePlanScreen } from "./plan-context";
import {
  CheckingChange,
  OfferPreview,
  getGoalDateMove,
  useApplyPreview,
} from "./plan-offer-preview";
import { currentPlanPreview } from "./plan-preview-state";
import { usePastDateText } from "./plan-status-label";
import {
  PlanChangeSuggestion,
  type SlotItem,
  usePlanSuggestionSlot,
} from "./plan-suggestion-context";
import { useTimeToCover, useTimeToCoverTexts } from "./use-time-to-cover";

function OtherOptions({ item }: { item: SlotItem }) {
  const t = useExtracted();
  const { dismiss, host } = usePlanSuggestionSlot();

  return (
    <SuggestionMenu>
      <DropdownMenuItem onClick={() => host.onEdit("date")}>{t("Adjust plan")}</DropdownMenuItem>
      <DropdownMenuItem onClick={() => dismiss(item.key)}>{t("Not now")}</DropdownMenuItem>
    </SuggestionMenu>
  );
}

type DateSearch = "building" | "failed" | "finding" | "noDate" | null;

/**
 * A goal's new date is found only when the learner taps Preview: finding it plans the goal at each
 * candidate date.
 */
export function PastDateSuggestion({ item }: { item: Extract<SlotItem, { kind: "pastDate" }> }) {
  const { goal } = usePlanScreen();

  return goal.kind === "exam" ? (
    <ExamOverSuggestion item={item} />
  ) : (
    <DateOverSuggestion item={item} />
  );
}

/** An exam that's over: the page's bar holds its answers (`PlanExamOverBar`). */
function ExamOverSuggestion({ item }: { item: Extract<SlotItem, { kind: "pastDate" }> }) {
  const pastDateText = usePastDateText();
  const { ask, title } = pastDateText({ isExam: true, lessons: item.lessons });

  return (
    <PlanChangeSuggestion item={item} mark={<CalendarClockIcon />} title={title}>
      <SuggestionDescription>{ask}</SuggestionDescription>
    </PlanChangeSuggestion>
  );
}

function DateOverSuggestion({ item }: { item: Extract<SlotItem, { kind: "pastDate" }> }) {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();
  const pastDateText = usePastDateText();
  const texts = useTimeToCoverTexts();
  const finder = useTimeToCover();
  const { plan } = usePlanScreen();
  const { dismiss, host, preview: storedPreview, requestPreview } = usePlanSuggestionSlot();
  const { apply, isPending } = useApplyPreview(item);
  const [operations, setOperations] = useState<LearnerPlanOperation[] | null>(null);
  const [search, setSearch] = useState<DateSearch>(null);
  // The search the learner waits for (0 for none), so one put off or superseded shows nothing.
  const waiting = useRef(0);
  const asked = useRef(0);
  const { title } = pastDateText({ isExam: false, lessons: item.lessons });
  const preview = currentPlanPreview({ operations: operations ?? [], plan, state: storedPreview });

  const showChange = async () => {
    asked.current += 1;
    const request = asked.current;
    waiting.current = request;
    setSearch("finding");
    const found = await finder.find();

    if (waiting.current !== request) {
      return;
    }

    waiting.current = 0;

    if (found.status !== "answered") {
      setSearch(found.status === "stale" ? null : found.status);
      setOperations(null);
      return;
    }

    const { fittingDate } = found.time;

    if (!fittingDate) {
      setSearch("noDate");
      return;
    }

    const moved: LearnerPlanOperation[] = [{ kind: "setTargetDate", targetDate: fittingDate }];
    setSearch(null);
    setOperations(moved);
    void requestPreview(moved);
  };

  const stopWaiting = () => {
    waiting.current = 0;
    setSearch(null);
  };

  const retry = search === "failed" || search === "building";
  const previewing = preview.status !== "idle" && operations !== null;
  const [moved] = operations ?? [];

  const question =
    moved?.kind === "setTargetDate" && moved.targetDate
      ? t("Move your end date to {date}?", { date: formatDate(moved.targetDate, "long") })
      : title;

  const body = () => {
    if (previewing) {
      return (
        <OfferPreview
          goalDate={getGoalDateMove({ operations, targetDate: plan.schedule.targetDate })}
          onApply={() => apply(preview)}
          onRetry={() => void requestPreview(operations)}
          pending={isPending}
          preview={preview}
        />
      );
    }

    if (search === "finding") {
      return <CheckingChange onCancel={stopWaiting} />;
    }

    if (search === "noDate") {
      return (
        <>
          <SuggestionDescription role="status">{texts.noDate}</SuggestionDescription>
          <SuggestionActions>
            <SuggestionAction onClick={() => host.onEdit("date")}>
              {t("Adjust plan")}
            </SuggestionAction>
            <SuggestionAction onClick={() => dismiss(item.key)} variant="outline">
              {t("Not now")}
            </SuggestionAction>
          </SuggestionActions>
        </>
      );
    }

    const offerText = t(
      "{count, plural, one {You have # lesson left. A later end date fits it.} other {You have # lessons left. A later end date fits them.}}",
      { count: item.lessons },
    );

    const retryText = search === "building" ? texts.building : t("We couldn't check what changes.");

    return (
      <>
        <SuggestionDescription role={retry ? "status" : undefined}>
          {retry ? retryText : offerText}
        </SuggestionDescription>
        <SuggestionActions>
          <SuggestionAction action={() => void showChange()} key="preview">
            {retry ? t("Try again") : t("Find a date")}
          </SuggestionAction>

          <OtherOptions item={item} />
        </SuggestionActions>
      </>
    );
  };

  return (
    <PlanChangeSuggestion
      item={item}
      mark={<CalendarClockIcon />}
      title={previewing ? question : title}
    >
      {body()}
    </PlanChangeSuggestion>
  );
}
