"use client";

import { type LearnerPlanOperation } from "@zoonk/core/plans/contract";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@zoonk/ui/components/dropdown-menu";
import { CalendarClockIcon, ChevronDownIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useRef, useState } from "react";
import {
  SuggestionAction,
  SuggestionActions,
  SuggestionDescription,
} from "../_components/suggestion";
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

const STUDY_AFTER_EXAM: LearnerPlanOperation[] = [{ fullCourse: true, kind: "setFullCourse" }];

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

type DateSearch = "building" | "failed" | "finding" | "noDate" | null;

/** A goal's new date is found only when the learner taps Preview: finding it plans the goal at each candidate date. */
export function PastDateSuggestion({ item }: { item: Extract<SlotItem, { kind: "pastDate" }> }) {
  const t = useExtracted();
  const pastDateText = usePastDateText();
  const texts = useTimeToCoverTexts();
  const finder = useTimeToCover();
  const { goal, plan } = usePlanScreen();
  const { dismiss, host, preview: storedPreview, requestPreview } = usePlanSuggestionSlot();
  const { apply, failed, isPending } = useApplyPreview(item);
  const [operations, setOperations] = useState<LearnerPlanOperation[] | null>(null);
  const [search, setSearch] = useState<DateSearch>(null);
  // The search the learner still waits for (0 for none), so one put off or superseded shows nothing.
  const waiting = useRef(0);
  const asked = useRef(0);
  const isExam = goal.kind === "exam";
  const { title } = pastDateText({ isExam, lessons: item.lessons });
  const preview = currentPlanPreview({ operations: operations ?? [], plan, state: storedPreview });

  const showChange = async () => {
    if (isExam) {
      setOperations(STUDY_AFTER_EXAM);
      void requestPreview(STUDY_AFTER_EXAM);
      return;
    }

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

  const body = () => {
    if (preview.status !== "idle" && operations) {
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

    const doesText = isExam
      ? t("Every topic, even after the exam, at your own pace.")
      : t("Move your date so your time covers what's left.");

    const retryText = search === "building" ? texts.building : t("We couldn't check what changes.");

    return (
      <>
        <SuggestionDescription role={retry ? "status" : undefined}>
          {retry ? retryText : doesText}
        </SuggestionDescription>
        <SuggestionActions>
          <SuggestionAction key="preview" onClick={() => void showChange()}>
            {retry ? t("Try again") : t("Preview")}
          </SuggestionAction>
          <OtherOptions item={item} />
        </SuggestionActions>
      </>
    );
  };

  return (
    <PlanChangeSuggestion failed={failed} item={item} mark={<CalendarClockIcon />} title={title}>
      {body()}
    </PlanChangeSuggestion>
  );
}
