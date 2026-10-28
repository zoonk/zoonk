"use client";

import { type ExamChoiceView } from "@zoonk/core/exams/choices/contract";
import { type LearnerPlanOperation } from "@zoonk/core/plans/contract";
import { type PlanChangeView } from "@zoonk/core/plans/view-contract";
import { type StudyNextView } from "@zoonk/core/view-models/map/contract";
import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { createContext, use } from "react";
import { DoneMark } from "../_components/status-mark";
import {
  Suggestion,
  SuggestionAction,
  SuggestionActions,
  SuggestionContent,
  SuggestionHeader,
  SuggestionLine,
  SuggestionOpen,
  SuggestionResult,
  SuggestionSaveError,
  SuggestionSummary,
} from "../_components/suggestion";
import { type GoalStatusControl } from "../journey/goal-actions";
import { type PlanEditorSection } from "./plan-editor-sections";
import { type PlanPreviewState } from "./plan-preview-state";
import { useUndoChange } from "./use-undo-change";

export type SlotItem =
  | { key: string; kind: "behind" | "tooTight"; text: string }
  | { choice: ExamChoiceView; key: string; kind: "choice" }
  | { key: string; kind: "coverage" | "finished" | "fitLessons" | "freeWeekOver" | "paused" }
  | { key: string; kind: "pastDate"; lessons: number };

export type SlotResult = { change: PlanChangeView | null; item: SlotItem; text: string };

export type SlotPreview = PlanPreviewState;

export type PlanSuggestionHost = {
  courseHref: (course: { brandSlug: string; courseSlug: string }) => string;
  goalStatus: GoalStatusControl | null;
  next: { onContinue: () => Promise<boolean>; view: StudyNextView } | null;
  onAdjust: () => void;
  onEdit: (section: PlanEditorSection) => void;
};

type SlotValue = {
  count: number;
  dismiss: (key: string) => void;
  host: PlanSuggestionHost;
  index: number;
  items: SlotItem[];
  move: (step: -1 | 1) => void;
  preview: SlotPreview;
  result: SlotResult | null;
  requestPreview: (operations: LearnerPlanOperation[]) => Promise<void>;
  setPreview: () => void;
  setResult: (result: SlotResult | null) => void;
};

export const PlanSuggestionContext = createContext<SlotValue | null>(null);

export function usePlanSuggestionSlot(): SlotValue {
  const value = use(PlanSuggestionContext);

  if (!value) {
    throw new Error("The Plan's suggestions must be used within PlanSuggestionProvider");
  }

  return value;
}

export function useSlotAnswer(item: Pick<SlotItem, "key">): SlotResult | null {
  const { result } = usePlanSuggestionSlot();
  return result?.item.key === item.key ? result : null;
}

/** Lives outside the keyed suggestion on every width, so paging preserves keyboard focus. */
export function SlotPager({ className }: { className?: string }) {
  const t = useExtracted();
  const { count, index, move, result } = usePlanSuggestionSlot();

  if (count < 2) {
    return null;
  }

  return (
    <div
      className={cn("-my-1 flex items-center justify-end gap-1", result && "invisible", className)}
      data-slot="suggestion-pager"
    >
      <Button onClick={() => move(-1)} size="icon-sm" variant="ghost">
        <ChevronLeftIcon aria-hidden="true" />
        <span className="sr-only">{t("Previous")}</span>
      </Button>
      <span className="text-muted-foreground font-mono text-[0.6875rem] tabular-nums">
        {t("{number, number} of {total, number}", { number: index + 1, total: count })}
      </span>
      <Button onClick={() => move(1)} size="icon-sm" variant="ghost">
        <ChevronRightIcon aria-hidden="true" />
        <span className="sr-only">{t("Next")}</span>
      </Button>
    </div>
  );
}

export function SlotContent({ children }: { children: React.ReactNode }) {
  return (
    <SuggestionContent className="min-[72rem]:bg-transparent min-[72rem]:ring-0">
      {children}
    </SuggestionContent>
  );
}

export function SlotUndo({ item }: { item: SlotItem }) {
  const t = useExtracted();
  const { setResult } = usePlanSuggestionSlot();
  const change = useSlotAnswer(item)?.change ?? null;

  const { failed, isPending, undo } = useUndoChange({
    change: { id: change?.id ?? "" },
    onUndone: () => setResult(null),
  });

  if (!change?.canUndo) {
    return null;
  }

  return (
    <>
      <SuggestionAction disabled={isPending} onClick={undo} variant="outline">
        {t("Undo")}
      </SuggestionAction>
      {failed && <SuggestionSaveError />}
    </>
  );
}

export function PlanChangeSuggestion({
  children,
  failed,
  item,
  mark,
  title,
}: {
  children: React.ReactNode;
  failed: boolean;
  item: SlotItem;
  mark?: React.ReactNode;
  title: string;
}) {
  const t = useExtracted();
  const answer = useSlotAnswer(item);
  const undo = answer && <SlotUndo item={item} />;

  return (
    <Suggestion
      answered={answer !== null}
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
            {children}
            {failed && <SuggestionSaveError />}
          </>
        )}
      </SlotContent>
    </Suggestion>
  );
}
