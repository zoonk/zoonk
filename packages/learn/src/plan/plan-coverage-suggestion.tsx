"use client";

import { type LearnerPlanOperation } from "@zoonk/core/plans/contract";
import { getMoreTime } from "@zoonk/core/plans/time-advice-contract";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@zoonk/ui/components/dropdown-menu";
import { ChevronDownIcon } from "lucide-react";
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
import { useFormatIsoDate } from "../_utils/iso-date";
import { useFormatShare } from "../_utils/percent";
import { useFormatDuration } from "../_utils/time-format";
import { PlanEffectDiff } from "../plan-diff/plan-effect-diff";
import { usePlanScreen } from "./plan-context";
import { useCoveredText, type usePlanCoverage, useTargetText } from "./plan-coverage";
import { useCanChooseFocus, useChooseFocus } from "./plan-focus";
import { useFullCourse, useFullCourseText } from "./plan-full-course";
import { currentPlanPreview } from "./plan-preview-state";
import {
  SlotContent,
  type SlotItem,
  type SlotPreview,
  SlotUndo,
  usePlanSuggestionSlot,
  useSlotAnswer,
  useSlotAnswered,
} from "./plan-suggestion-context";
import { useStudyEverything } from "./study-everything";
import { useChangeSentence } from "./use-change-sentence";
import { usePlanChange } from "./use-plan-change";

type Coverage = NonNullable<ReturnType<typeof usePlanCoverage>>;

/** The change the suggestion offers, in words and as the operations that make it. */
type CoverageOffer = { operations: LearnerPlanOperation[]; title: string };

/**
 * What the slot offers when the learner's time doesn't cover their goal: an exam studying
 * everything can end at the exam again; otherwise the date their time covers it all by (when no
 * daily time does), or the daily time that covers it in depth (or the most, when none does), only
 * when it's more than theirs (see `getMoreTime`): Pedro was offered "10 min a day covers
 * everything" beside his 15. Null when nothing is worth one tap: the options are all that's left
 * then.
 */
function useCoverageOffer(coverage: Coverage | null): CoverageOffer | null {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const formatShare = useFormatShare();
  const formatDate = useFormatIsoDate();
  const course = useFullCourse();
  const text = useFullCourseText();
  const { plan } = usePlanScreen();

  if (!coverage || !plan.feasibility) {
    return null;
  }

  if (course?.on) {
    return { operations: course.operations(false), title: text.finish(course) };
  }

  if (coverage.fittingDate) {
    return {
      operations: [{ kind: "setTargetDate", targetDate: coverage.fittingDate }],
      title: t("Your time covers everything by {date}", {
        date: formatDate(coverage.fittingDate, "long"),
      }),
    };
  }

  const target = getMoreTime({ ...plan.feasibility, dailyMinutes: plan.schedule.dailyMinutes });

  if (!target) {
    return null;
  }

  const time = formatDuration(target.dailyMinutes);

  return {
    operations: [{ kind: "setDailyMinutes", minutes: target.dailyMinutes }],
    title:
      target.kind === "inDepth"
        ? t("{time} a day covers everything in depth", { time })
        : t("{time} a day covers about {share} in depth", {
            share: formatShare(target.coveredShare),
            time,
          }),
  };
}

/**
 * What the suggestion says under its title: what the learner's time covers now, and, when no daily
 * time covers everything by the date, honestly how much the most time a day would; or what an exam
 * studying everything does until the exam.
 */
function useCoverageDescription(coverage: Coverage | null): string[] {
  const t = useExtracted();
  const coveredText = useCoveredText();
  const targetText = useTargetText();
  const course = useFullCourse();

  if (!coverage) {
    return [];
  }

  if (course?.on) {
    return [t("Until the exam, what comes up most comes first.")];
  }

  // Offered a later date, the learner also hears what the most time a day would reach by theirs.
  const most =
    coverage.fittingDate && coverage.target?.kind === "more" ? targetText(coverage.target) : null;

  return [coveredText(coverage), most].filter((line) => line !== null);
}

/**
 * The other ways to change what the plan covers, in one menu: choosing where to focus, studying
 * everything at the learner's own pace (an exam's after the exam), and "Not now", which leaves the
 * suggestion out until the Plan opens again.
 */
function OtherOptions({ coverage }: { coverage: Coverage }) {
  const t = useExtracted();
  const canChooseFocus = useCanChooseFocus();
  const chooseFocus = useChooseFocus();
  const studyEverything = useStudyEverything();
  const course = useFullCourse();
  const { dismiss } = usePlanSuggestionSlot();
  const canStudyEverything = course && !course.on && !coverage.fittingDate;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<SuggestionAction variant="outline" />}>
        {t("Other options")}
        <ChevronDownIcon aria-hidden="true" data-icon="inline-end" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-64">
        {canChooseFocus && (
          <DropdownMenuItem onClick={chooseFocus}>{t("Choose where to focus")}</DropdownMenuItem>
        )}
        {canStudyEverything && (
          <DropdownMenuItem onClick={() => studyEverything(course)}>
            {course.isExam ? t("Study everything after the exam") : t("Study everything")}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => dismiss("coverage")}>{t("Not now")}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * What the offer does before it's applied: the plan's dates that move, as a diff. While it's being
 * checked, and when it couldn't be, it says so in place over the same row of actions, so the panel
 * doesn't jump, with the way to read it again (`onRetry`) or put it off.
 */
function OfferPreview({
  onApply,
  onRetry,
  pending,
  preview,
}: {
  onApply: () => void;
  onRetry: () => void;
  pending: boolean;
  preview: SlotPreview;
}) {
  const t = useExtracted();
  const { setPreview } = usePlanSuggestionSlot();

  if (preview.status === "loading") {
    return (
      <>
        <SuggestionDescription aria-busy="true" role="status">
          {t("Checking what changes…")}
        </SuggestionDescription>
        <SuggestionActions>
          {/* Keyed, so a focused Try again never turns into the Not now beside it. */}
          <SuggestionAction key="not-now" onClick={() => setPreview()} variant="outline">
            {t("Not now")}
          </SuggestionAction>
        </SuggestionActions>
      </>
    );
  }

  if (preview.status === "failed") {
    return (
      <>
        <SuggestionDescription role="status">
          {t("We couldn't check what changes.")}
        </SuggestionDescription>
        <SuggestionActions>
          <SuggestionAction key="retry" onClick={onRetry}>
            {t("Try again")}
          </SuggestionAction>
          <SuggestionAction key="not-now" onClick={() => setPreview()} variant="outline">
            {t("Not now")}
          </SuggestionAction>
        </SuggestionActions>
      </>
    );
  }

  if (preview.status !== "ready") {
    return null;
  }

  const { effect, feasibility, unchanged } = preview.preview;

  return (
    <>
      {unchanged ? (
        <SuggestionDescription>{t("Your plan stays as it is.")}</SuggestionDescription>
      ) : (
        <PlanEffectDiff effect={effect} />
      )}

      {!unchanged && feasibility?.fits && (
        <SuggestionDescription>
          {t("Your plan then covers everything in depth.")}
        </SuggestionDescription>
      )}

      <SuggestionActions>
        {/* Never applied without the diff it makes, as Today's proposals. */}
        {!unchanged && effect !== null && (
          <SuggestionAction disabled={pending} onClick={onApply}>
            {t("Apply")}
          </SuggestionAction>
        )}
        <SuggestionAction disabled={pending} onClick={() => setPreview()} variant="outline">
          {t("Not now")}
        </SuggestionAction>
      </SuggestionActions>
    </>
  );
}

/**
 * The plan's coverage as the slot's suggestion: what the learner's time covers, the one change
 * worth making (the time that covers everything in depth, or the date their time covers it all
 * by), and the other ways in a menu. "Preview" shows what the change moves as a diff before
 * anything is saved; Apply saves it, and the slot says "Plan updated" with what it did and Undo,
 * in the same place, even once the plan covers everything (`coverage` null).
 */
export function CoverageSuggestion({ coverage }: { coverage: Coverage | null }) {
  const t = useExtracted();
  const sentence = useChangeSentence();
  const offer = useCoverageOffer(coverage);
  const description = useCoverageDescription(coverage);
  const { plan } = usePlanScreen();
  const { change, failed, isPending } = usePlanChange();
  const { preview: storedPreview, requestPreview, setPreview, setResult } = usePlanSuggestionSlot();

  const preview = currentPlanPreview({
    operations: offer?.operations ?? [],
    plan,
    state: storedPreview,
  });

  const previewOffer = () => offer && requestPreview(offer.operations);
  const item: SlotItem = { key: "coverage", kind: "coverage" };
  const answer = useSlotAnswer(item);
  const answered = useSlotAnswered(item);
  const [covered = ""] = description;
  const title = offer?.title ?? covered;

  const apply = () => {
    if (
      preview.status !== "ready" ||
      preview.preview.unchanged ||
      preview.preview.effect === null
    ) {
      return;
    }

    void change(preview.operations, (outcome) => {
      if (outcome?.status === "applied") {
        setPreview();

        setResult({
          change: outcome.change,
          item,
          text: outcome.change ? sentence(outcome.change) : t("Your plan is updated."),
        });
      }
    });
  };

  const undo = answer && <SlotUndo item={item} />;
  const previewing = preview.status !== "idle";

  return (
    <Suggestion answered={answered} label={t("Plan suggestion")} mark={answer && <DoneMark />}>
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
            {offer &&
              description.map((line) => (
                <SuggestionDescription key={line}>{line}</SuggestionDescription>
              ))}

            {previewing && offer ? (
              <OfferPreview
                onApply={apply}
                onRetry={() => void previewOffer()}
                pending={isPending}
                preview={preview}
              />
            ) : (
              <SuggestionActions>
                {offer && (
                  <SuggestionAction onClick={() => void previewOffer()}>
                    {t("Preview")}
                  </SuggestionAction>
                )}
                {coverage && <OtherOptions coverage={coverage} />}
              </SuggestionActions>
            )}

            {failed && (
              <SuggestionError>{t("That didn't work. Try again in a moment.")}</SuggestionError>
            )}
          </>
        )}
      </SlotContent>
    </Suggestion>
  );
}
