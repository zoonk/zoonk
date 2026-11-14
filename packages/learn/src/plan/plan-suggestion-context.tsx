"use client";

import { type ExamChoiceView } from "@zoonk/core/exams/choices/contract";
import { type LearnerPlanOperation } from "@zoonk/core/plans/contract";
import { type PlanChangePreview } from "@zoonk/core/plans/preview-contract";
import { type PlanChangeView } from "@zoonk/core/plans/view-contract";
import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { ChevronRightIcon, Undo2Icon } from "lucide-react";
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
  SuggestionSummary,
} from "../_components/suggestion";
import { type PlanCertificates } from "../journey/course-certificate";
import { type GoalStatusControl } from "../journey/goal-actions";
import { type StudyNext } from "../journey/study-next";
import { type PlanEditorSection } from "./plan-editor-sections";
import { type PlanPreviewState } from "./plan-preview-state";
import { useUndoChange } from "./use-undo-change";

export type SlotItem =
  | { choice: ExamChoiceView; key: string; kind: "choice" }
  | {
      key: string;
      kind: "courseComplete" | "coverage" | "doesNotFit" | "finished" | "fitLessons" | "paused";
    }
  | { key: string; kind: "pastDate"; lessons: number };

export type SlotResult = { change: PlanChangeView | null; item: SlotItem; text: string };

export type SlotPreview = PlanPreviewState;

/** From the goal map: what to study next once the plan is finished, and its certificates once a level or the plan is. */
export type PlanEnd = { certificates: PlanCertificates | null; next: StudyNext | null };

export type PlanSuggestionHost = PlanEnd & {
  courseHref: (course: { brandSlug: string; courseSlug: string }) => string;
  goalStatus: GoalStatusControl | null;
  onAdjust: () => void;
  onEdit: (section: PlanEditorSection) => void;
};

type SlotValue = {
  count: number;
  dismiss: (key: string) => void;
  host: PlanSuggestionHost;
  index: number;
  items: SlotItem[];
  showNext: () => void;
  preview: SlotPreview;
  result: SlotResult | null;
  requestPreview: (operations: LearnerPlanOperation[]) => Promise<PlanChangePreview | null>;
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

/** Lives outside the keyed suggestion on every width, so bringing up the next keeps keyboard focus. */
export function SlotPager({ className }: { className?: string }) {
  const t = useExtracted();
  const { count, result, showNext } = usePlanSuggestionSlot();

  if (count < 2) {
    return null;
  }

  return (
    <div
      className={cn("-my-1 flex items-center justify-end", result && "invisible", className)}
      data-slot="suggestion-pager"
    >
      <Button
        className="text-muted-foreground"
        edge="end"
        onClick={showNext}
        size="sm"
        variant="ghost"
      >
        {t("{count, plural, one {# more} other {# more}}", { count: count - 1 })}
        <ChevronRightIcon aria-hidden="true" data-icon="inline-end" />
      </Button>
    </div>
  );
}

export function SlotContent({
  children,
  statement,
}: {
  children: React.ReactNode;
  statement?: boolean;
}) {
  return (
    <SuggestionContent
      className="min-[72rem]:bg-transparent min-[72rem]:ring-0"
      statement={statement}
    >
      {children}
    </SuggestionContent>
  );
}

export function SlotUndo({ item }: { item: SlotItem }) {
  const t = useExtracted();
  const { setResult } = usePlanSuggestionSlot();
  const change = useSlotAnswer(item)?.change ?? null;

  const { isPending, undo } = useUndoChange({
    change: { id: change?.id ?? "" },
    onUndone: () => setResult(null),
  });

  if (!change?.canUndo) {
    return null;
  }

  return (
    <SuggestionAction
      action={undo}
      busy={isPending}
      icon={<Undo2Icon aria-hidden="true" />}
      variant="outline"
    >
      {t("Undo")}
    </SuggestionAction>
  );
}

export function PlanChangeSuggestion({
  children,
  item,
  mark,
  onOpen,
  summary,
  title,
}: {
  children: React.ReactNode;
  item: SlotItem;
  mark?: React.ReactNode;
  onOpen?: () => void;
  /** The line on the page, when the sheet it opens has a title of its own. */
  summary?: string;
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
      onOpen={onOpen}
    >
      <SuggestionLine>
        {answer ? (
          <>
            <SuggestionResult>{answer.text}</SuggestionResult>
            {undo}
          </>
        ) : (
          <>
            <SuggestionSummary>{summary ?? title}</SuggestionSummary>
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
          children
        )}
      </SlotContent>
    </Suggestion>
  );
}
