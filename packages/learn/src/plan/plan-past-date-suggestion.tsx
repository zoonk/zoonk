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
  SlotContent,
  type SlotItem,
  SlotUndo,
  usePlanSuggestionSlot,
  useSlotAnswer,
  useSlotAnswered,
} from "./plan-suggestion-context";
import { useTimeToCover, useTimeToCoverTexts } from "./use-time-to-cover";

/** An exam's date is the exam's: its plan goes on after it, at the learner's pace. */
const STUDY_AFTER_EXAM: LearnerPlanOperation[] = [{ fullCourse: true, kind: "setFullCourse" }];

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

/** Where finding a goal's new date stands before its preview. */
type DateSearch = "building" | "failed" | "finding" | "noDate" | null;

/**
 * The plan's date came with lessons left (status `pastDate`): the plan doesn't end. The slot says
 * how many lessons are left and what the change that keeps the plan going does: a goal's own date
 * moves to the day the learner's time covers what's left, found when they tap Preview (it plans the
 * goal at each candidate date, so never for the page); an exam's plan goes on after the exam,
 * whose date is fixed. Preview shows the change's diff, with the date or the end it moves to, and
 * Apply saves it. Lucas, a day past his date, read "Your plan ended · 13 lessons were left out"
 * and was offered the course's next level. The editor at its date is the other way on.
 */
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
  // The search the learner still waits for (0 for none), so one they put off ("Not now"), or one an
  // earlier tap started, shows nothing.
  const waiting = useRef(0);
  const asked = useRef(0);
  const answer = useSlotAnswer(item);
  const answered = useSlotAnswered(item);
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

    // Put off ("Not now"), or asked again since: this answer is no one's.
    if (waiting.current !== request) {
      return;
    }

    waiting.current = 0;

    if (found.status !== "answered") {
      // The plan changed while it searched: the card goes back to what it says, with Preview.
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

  const undo = answer && <SlotUndo item={item} />;
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
      : t("Move your date to the day your time covers what's left.");

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
    <Suggestion
      answered={answered}
      label={t("Plan suggestion")}
      mark={answer ? <DoneMark /> : <CalendarClockIcon />}
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
            {body()}

            {failed && (
              <SuggestionError>{t("That didn't work. Try again in a moment.")}</SuggestionError>
            )}
          </>
        )}
      </SlotContent>
    </Suggestion>
  );
}
