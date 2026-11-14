"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { CalendarClockIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useEffect, useState } from "react";
import {
  Suggestion,
  SuggestionAction,
  SuggestionActions,
  SuggestionDescription,
  SuggestionHeader,
  SuggestionLine,
  SuggestionSummary,
} from "../_components/suggestion";
import { CourseCompleteSuggestion } from "../journey/course-certificate";
import { GoalPausedSuggestion } from "../journey/goal-actions";
import { StudyNextSuggestion } from "../journey/study-next";
import { usePlanScreen } from "./plan-context";
import { usePlanCoverage, useTimeEnough } from "./plan-coverage";
import { CoverageSuggestion } from "./plan-coverage-suggestion";
import { ExamChoiceSuggestion } from "./plan-exam-choices";
import { FitLessonsSuggestion } from "./plan-fit-suggestion";
import { PastDateSuggestion } from "./plan-past-date-suggestion";
import {
  PlanSuggestionContext,
  type PlanSuggestionHost,
  SlotContent,
  type SlotItem,
  SlotPager,
  type SlotResult,
  usePlanSuggestionSlot,
} from "./plan-suggestion-context";
import { usePlanPreview } from "./use-plan-preview";

const RESULT_MS = 8000;

const SLOT_DATA = "plan-suggestion";

function isLearnerOnSlot(): boolean {
  return [...document.querySelectorAll(`[data-slot="${SLOT_DATA}"]`)].some(
    (slot) => slot.contains(document.activeElement) || slot.matches(":hover"),
  );
}

function useTimeItems(): SlotItem[] {
  const { plan } = usePlanScreen();
  const coverage = usePlanCoverage();
  const timeEnough = useTimeEnough();
  const open = plan.status?.kind !== "pastDate";

  return [
    open && plan.fitOffer !== null && { key: "fitLessons", kind: "fitLessons" as const },
    open && coverage !== null && !timeEnough && { key: "coverage", kind: "coverage" as const },
  ].filter((item) => item !== false);
}

function usePlanSuggestions(host: PlanSuggestionHost): SlotItem[] {
  const { plan } = usePlanScreen();
  const timeItems = useTimeItems();
  const status = plan.status?.kind;
  const finished = host.next !== null;
  const claimable = Boolean(host.certificates?.unclaimed.length);

  const items: (SlotItem | false)[] = [
    !finished && claimable && { key: "courseComplete", kind: "courseComplete" },
    // A paused goal and a passed date are what the page asks about first (the bar answers both on an exam).
    host.goalStatus?.status === "paused" && { key: "paused", kind: "paused" },
    plan.status?.kind === "pastDate" && {
      key: "pastDate",
      kind: "pastDate",
      lessons: plan.status.lessons,
    },
    ...plan.examChoices
      .filter((choice) => choice.subjects.length === 0)
      .map((choice): SlotItem => ({ choice, key: `choice:${choice.group}`, kind: "choice" })),
    ...(finished ? timeItems : []),
    finished && { key: "finished", kind: "finished" },
    status === "needsAdjusting" && { key: "doesNotFit", kind: "doesNotFit" },
    ...(finished ? [] : timeItems),
  ];

  return items.filter((item) => item !== false);
}

/** The slot shows twice (a line under 72rem, a panel from it), so both read this one state. */
export function PlanSuggestionProvider({
  children,
  host,
}: {
  children: React.ReactNode;
  host: PlanSuggestionHost;
}) {
  const all = usePlanSuggestions(host);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [position, setPosition] = useState(0);
  const { preview, requestPreview, setPreview } = usePlanPreview();
  const [result, setResult] = useState<SlotResult | null>(null);
  const items = all.filter((item) => !dismissed.includes(item.key));
  const index = Math.min(position, Math.max(0, items.length - 1));

  // The result stays a moment with its Undo, longer while focus or the pointer is on it.
  useEffect(() => {
    if (!result) {
      return;
    }

    let timer: ReturnType<typeof setTimeout>;

    const settle = () => {
      if (isLearnerOnSlot()) {
        timer = setTimeout(settle, RESULT_MS);
        return;
      }

      setResult(null);
    };

    timer = setTimeout(settle, RESULT_MS);
    return () => clearTimeout(timer);
  }, [result]);

  const showNext = () => {
    setPreview();
    setPosition((index + 1) % items.length);
  };

  return (
    <PlanSuggestionContext
      value={{
        count: items.length,
        dismiss: (key) => {
          setPreview();
          setDismissed((current) => [...current, key]);
        },
        host,
        index,
        items,
        preview,
        requestPreview,
        result,
        setPreview,
        setResult,
        showNext,
      }}
    >
      {children}
    </PlanSuggestionContext>
  );
}

function DoesNotFitSuggestion() {
  const t = useExtracted();
  const { host } = usePlanSuggestionSlot();
  const title = t("More lessons than days left");

  return (
    <Suggestion label={title} mark={<CalendarClockIcon />}>
      <SuggestionLine>
        <SuggestionSummary>{title}</SuggestionSummary>
        <SuggestionAction onClick={host.onAdjust} variant="outline">
          {t("Adjust")}
        </SuggestionAction>
      </SuggestionLine>

      <SlotContent>
        <SuggestionHeader>{title}</SuggestionHeader>
        <SuggestionDescription>{t("Add time a day or pick a later date.")}</SuggestionDescription>
        <SuggestionActions>
          <SuggestionAction onClick={host.onAdjust}>{t("Adjust plan")}</SuggestionAction>
        </SuggestionActions>
      </SlotContent>
    </Suggestion>
  );
}

function SlotSuggestion({ item }: { item: SlotItem }) {
  const { goal } = usePlanScreen();
  const coverage = usePlanCoverage();
  const { host } = usePlanSuggestionSlot();

  switch (item.kind) {
    case "doesNotFit":
      return <DoesNotFitSuggestion />;
    case "choice":
      return <ExamChoiceSuggestion item={item} />;
    case "courseComplete":
      return (
        host.certificates && (
          <CourseCompleteSuggestion
            onClaim={host.certificates.onClaim}
            unclaimed={host.certificates.unclaimed}
          />
        )
      );
    case "coverage":
      return <CoverageSuggestion coverage={coverage} />;
    case "finished":
      return (
        host.next && (
          <StudyNextSuggestion
            certificates={host.certificates}
            courseHref={host.courseHref}
            next={host.next}
          />
        )
      );
    case "fitLessons":
      return <FitLessonsSuggestion item={item} />;
    case "paused":
      return (
        host.goalStatus && (
          <GoalPausedSuggestion control={host.goalStatus} goalTitle={goal.displayName} />
        )
      );
    case "pastDate":
      return <PastDateSuggestion item={item} />;
    default:
      return item satisfies never;
  }
}

export function PlanSuggestionSlot({ className }: { className?: string }) {
  const t = useExtracted();
  const { index, items, result } = usePlanSuggestionSlot();
  const item = result?.item ?? items[index];

  if (!item) {
    return null;
  }

  return (
    <div
      aria-label={t("Plan suggestion")}
      className={cn(
        "min-[72rem]:bg-card min-[72rem]:text-card-foreground min-[72rem]:ring-border min-[72rem]:rounded-xl min-[72rem]:ring-1 min-[72rem]:ring-inset",
        className,
      )}
      data-slot={SLOT_DATA}
      role="group"
    >
      {/* The panel's pager heads it, so paging never moves it under the pointer. */}
      <SlotPager className="hidden min-[72rem]:mx-3.5 min-[72rem]:mt-2.5 min-[72rem]:flex" />
      <SlotSuggestion item={item} key={item.key} />
      <SlotPager className="mt-1 min-[72rem]:hidden" />
    </div>
  );
}
