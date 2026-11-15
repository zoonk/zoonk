"use client";

import { type LearnerPlanOperation } from "@zoonk/core/plans/contract";
import { DropdownMenuItem } from "@zoonk/ui/components/dropdown-menu";
import { CalendarClockIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import {
  Suggestion,
  SuggestionAction,
  SuggestionActions,
  SuggestionDescription,
  SuggestionHeader,
  SuggestionLine,
  SuggestionSummary,
} from "../_components/suggestion";
import { SuggestionMenu } from "../_components/suggestion-menu";
import { useFormatIsoDate } from "../_utils/iso-date";
import { useSharedMark, useSharedState } from "./layout-shared";
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
  SlotContent,
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

type Operations = LearnerPlanOperation[] | null;

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

/**
 * An exam that's over: no actions, since the page's bar holds the answers (`PlanExamOverBar`) and a
 * sheet over it couldn't reach them.
 */
function ExamOverSuggestion({ item }: { item: Extract<SlotItem, { kind: "pastDate" }> }) {
  const t = useExtracted();
  const pastDateText = usePastDateText();
  const { title } = pastDateText({ isExam: true, lessons: item.lessons });
  // The Schedule number beside it says how many lessons are left.
  const ask = t("Keep studying, or archive this goal?");

  return (
    <Suggestion label={title} mark={<CalendarClockIcon />}>
      <SuggestionLine>
        <div>
          <SuggestionSummary>{title}</SuggestionSummary>
          <SuggestionDescription>{ask}</SuggestionDescription>
        </div>
      </SuggestionLine>

      <SlotContent statement>
        <SuggestionHeader>{title}</SuggestionHeader>
        <SuggestionDescription>{ask}</SuggestionDescription>
      </SlotContent>
    </Suggestion>
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
  const [operations, setOperations] = useSharedState<Operations>("operations", null);
  const [search, setSearch] = useSharedState<DateSearch>("search", null);
  // The search the learner waits for (0 for none), so one put off or superseded shows nothing.
  const waiting = useSharedMark("waiting", 0);
  const asked = useSharedMark("asked", 0);
  const { title } = pastDateText({ isExam: false, lessons: item.lessons });
  const preview = currentPlanPreview({ operations: operations ?? [], plan, state: storedPreview });

  const showChange = async () => {
    asked.write(asked.read() + 1);
    const request = asked.read();
    waiting.write(request);
    setSearch("finding");
    const found = await finder.find();

    if (waiting.read() !== request) {
      return;
    }

    waiting.write(0);

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
    waiting.write(0);
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
          <SuggestionActions
            main={
              <SuggestionAction onClick={() => host.onEdit("date")}>
                {t("Adjust plan")}
              </SuggestionAction>
            }
          >
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
        <SuggestionActions
          main={
            <SuggestionAction action={() => void showChange()} key="preview">
              {retry ? t("Try again") : t("Find a date")}
            </SuggestionAction>
          }
          menu={<OtherOptions item={item} />}
        />
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
