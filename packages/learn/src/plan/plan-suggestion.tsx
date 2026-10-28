"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { CalendarClockIcon, SparklesIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useEffect, useState } from "react";
import { useFreeWeekOverCopy } from "../_components/free-week-over";
import {
  Suggestion,
  SuggestionAction,
  SuggestionActions,
  SuggestionDescription,
  SuggestionHeader,
  SuggestionLine,
  SuggestionLinkAction,
  SuggestionOpen,
  SuggestionSummary,
} from "../_components/suggestion";
import { GoalPausedSuggestion } from "../journey/goal-actions";
import { StudyNextSuggestion } from "../journey/study-next";
import { useLearnRoutes } from "../learn-context";
import { usePlanScreen } from "./plan-context";
import { usePlanCoverage, useTimeEnough } from "./plan-coverage";
import { CoverageSuggestion } from "./plan-coverage-suggestion";
import { ExamChoiceSuggestion } from "./plan-exam-choices";
import { FitLessonsSuggestion } from "./plan-fit-suggestion";
import { usePaceFixText } from "./plan-notice";
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
  const open = !plan.access.freeWeekOver && plan.status?.kind !== "pastDate";

  return [
    open && plan.fitOffer !== null && { key: "fitLessons", kind: "fitLessons" as const },
    open && coverage !== null && !timeEnough && { key: "coverage", kind: "coverage" as const },
  ].filter((item) => item !== false);
}

function usePlanSuggestions(host: PlanSuggestionHost): SlotItem[] {
  const { plan } = usePlanScreen();
  const fix = usePaceFixText();
  const timeItems = useTimeItems();
  const status = plan.status?.kind;
  const finished = host.next !== null;

  const items: (SlotItem | false)[] = [
    host.goalStatus?.status === "paused" && { key: "paused", kind: "paused" },
    ...plan.examChoices
      .filter((choice) => !choice.subject)
      .map((choice): SlotItem => ({ choice, key: `choice:${choice.group}`, kind: "choice" })),
    plan.status?.kind === "pastDate" && {
      key: "pastDate",
      kind: "pastDate",
      lessons: plan.status.lessons,
    },
    ...(finished ? timeItems : []),
    finished && { key: "finished", kind: "finished" },
    status === "needsAdjusting" &&
      fix !== null && { key: "tooTight", kind: "tooTight", text: fix.text },
    status === "behind" && fix !== null && { key: "behind", kind: "behind", text: fix.text },
    ...(finished ? [] : timeItems),
    plan.access.freeWeekOver && { key: "freeWeekOver", kind: "freeWeekOver" },
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

  const move = (step: -1 | 1) => {
    setPreview();
    setPosition((index + step + items.length) % items.length);
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
        move,
        preview,
        requestPreview,
        result,
        setPreview,
        setResult,
      }}
    >
      {children}
    </PlanSuggestionContext>
  );
}

function PaceSuggestion({ item }: { item: Extract<SlotItem, { kind: "behind" | "tooTight" }> }) {
  const t = useExtracted();
  const routes = useLearnRoutes();
  const { host } = usePlanSuggestionSlot();

  const title =
    item.kind === "tooTight" ? t("Your plan no longer fits") : t("A little to catch up");

  return (
    <Suggestion label={title} mark={<CalendarClockIcon />}>
      <SuggestionLine>
        <SuggestionSummary>{item.text}</SuggestionSummary>
        {item.kind === "tooTight" ? (
          <SuggestionAction onClick={host.onAdjust} variant="outline">
            {t("Adjust")}
          </SuggestionAction>
        ) : (
          <SuggestionOpen />
        )}
      </SuggestionLine>

      <SlotContent>
        <SuggestionHeader>{title}</SuggestionHeader>
        {item.kind === "tooTight" ? (
          <SuggestionActions>
            <SuggestionAction onClick={host.onAdjust}>{t("Adjust plan")}</SuggestionAction>
          </SuggestionActions>
        ) : (
          <>
            <SuggestionDescription>{item.text}</SuggestionDescription>
            <SuggestionActions>
              <SuggestionLinkAction href={routes.today}>{t("Go to Today")}</SuggestionLinkAction>
            </SuggestionActions>
          </>
        )}
      </SlotContent>
    </Suggestion>
  );
}

function FreeWeekSuggestion() {
  const t = useExtracted();
  const routes = useLearnRoutes();
  const { body, title } = useFreeWeekOverCopy();

  return (
    <Suggestion label={title} mark={<SparklesIcon />}>
      <SuggestionLine>
        <SuggestionSummary>{title}</SuggestionSummary>
        <SuggestionLinkAction href={routes.upgrade} variant="outline">
          {t("See Plus")}
        </SuggestionLinkAction>
      </SuggestionLine>

      <SlotContent>
        <SuggestionHeader>{title}</SuggestionHeader>
        <SuggestionDescription>{body}</SuggestionDescription>
        <SuggestionActions>
          <SuggestionLinkAction href={routes.upgrade}>{t("See Plus")}</SuggestionLinkAction>
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
    case "behind":
    case "tooTight":
      return <PaceSuggestion item={item} />;
    case "choice":
      return <ExamChoiceSuggestion item={item} />;
    case "coverage":
      return <CoverageSuggestion coverage={coverage} />;
    case "finished":
      return host.next && <StudyNextSuggestion courseHref={host.courseHref} next={host.next} />;
    case "fitLessons":
      return <FitLessonsSuggestion item={item} />;
    case "freeWeekOver":
      return <FreeWeekSuggestion />;
    case "paused":
      return (
        host.goalStatus && <GoalPausedSuggestion control={host.goalStatus} goalTitle={goal.title} />
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
