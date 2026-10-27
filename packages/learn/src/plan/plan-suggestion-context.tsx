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

/**
 * One thing the Plan's slot can say, the most pressing first (see `usePlanSuggestions`): the goal
 * is paused, an exam choice is still to make, the plan's date came with lessons left, the plan is
 * finished, the plan no longer fits, the learner is behind, their time fits lessons the plan
 * doesn't hold, their time doesn't cover the goal, or a free exam plan's week is over. `key` tells
 * them apart, an exam's choices by their group.
 */
export type SlotItem =
  | { key: string; kind: "behind" | "tooTight"; text: string }
  | { choice: ExamChoiceView; key: string; kind: "choice" }
  | { key: string; kind: "coverage" | "finished" | "fitLessons" | "freeWeekOver" | "paused" }
  | { key: string; kind: "pastDate"; lessons: number };

/**
 * What the learner's answer did, said where the answers were, with Undo while it's the latest.
 * Undo puts the plan back and the slot back on the suggestion it answered.
 */
export type SlotResult = { change: PlanChangeView | null; item: SlotItem; text: string };

/** A change's preview, read when the learner asks to see what it does. */
export type SlotPreview = PlanPreviewState;

/** What the host gives the slot's suggestions to act with. */
export type PlanSuggestionHost = {
  /** A Library course's page, for the courses to study next. */
  courseHref: (course: { brandSlug: string; courseSlug: string }) => string;
  /** The goal's status and how to resume it; null leaves pausing out. */
  goalStatus: GoalStatusControl | null;
  /** Once the plan is finished: what to study next, and "Continue at the next level". */
  next: { onContinue: () => Promise<boolean>; view: StudyNextView } | null;
  /** Opens "Adjust plan". */
  onAdjust: () => void;
  /** Opens "Adjust plan" at one of its settings (a new date, for a plan past its date). */
  onEdit: (section: PlanEditorSection) => void;
};

type SlotValue = {
  /** How many things the slot has to say, and which one shows. */
  count: number;
  /** "Not now": the suggestion leaves the slot until the learner opens the Plan again. */
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

/** The answer the slot shows for `item`, while it shows one. */
export function useSlotAnswer(item: Pick<SlotItem, "key">): SlotResult | null {
  const { result } = usePlanSuggestionSlot();
  return result?.item.key === item.key ? result : null;
}

/**
 * "‹ 1 of 3 ›": the slot's other things to say, one at a time. Nothing for one alone; while an
 * answer's result shows, it keeps its room out of reach, so the result moves nothing. The panel
 * draws it at its head, where paging never moves it; under 72rem it sits under the line (see
 * `PlanSuggestionSlot`), so a line that acts on its own ("Adjust", "Resume") still leads to the
 * next thing. It lives outside the keyed suggestion on every width, so paging preserves keyboard
 * focus. The sheet has none: it holds one suggestion.
 */
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

/**
 * A suggestion's content in the slot (see `SuggestionContent`): what it says and asks. The slot
 * owns the desktop frame and pager, so only this content changes when the learner pages.
 */
export function SlotContent({ children }: { children: React.ReactNode }) {
  return (
    <SuggestionContent className="min-[72rem]:bg-transparent min-[72rem]:ring-0">
      {children}
    </SuggestionContent>
  );
}

/**
 * Undo for an answer's change while it's the plan's latest. It puts the plan back as it was, the
 * suggestion included, as Gmail's and Linear's undo do. The suggestion takes the keyboard when the
 * Undo button leaves (see `Suggestion`).
 */
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

/**
 * A change the slot suggests: its title and what it says (`children`, with its actions) until the
 * learner answers, then "Plan updated" with what the answer did and its Undo, in the same place.
 */
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
