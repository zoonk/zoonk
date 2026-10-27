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

/**
 * How long an answer's result (with its Undo) stays in the slot before the slot moves on, counted
 * again while the learner's focus or pointer is on it.
 */
const RESULT_MS = 8000;

const SLOT_DATA = "plan-suggestion";

/** Whether the learner's focus or pointer is on the slot, in either of its two places. */
function isLearnerOnSlot(): boolean {
  return [...document.querySelectorAll(`[data-slot="${SLOT_DATA}"]`)].some(
    (slot) => slot.contains(document.activeElement) || slot.matches(":hover"),
  );
}

/**
 * What the slot could say about the learner's time: the lessons their own time fits that the plan
 * doesn't hold (no more time asked, so first), then what more time would cover. When their time
 * already covers everything, the coverage has no time to offer: what the plan leaves out comes at
 * their time. Past its date, what the time covers by it says nothing (the date's offer comes
 * first), and a free exam plan past its first week opens nothing new with more time (they wait
 * for Plus).
 */
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

/**
 * Everything the Plan's slot could say, the most pressing first: the goal is paused, each exam
 * choice still to make (a plan "finished" while it leaves an exam's subject out isn't finished
 * yet), the plan's date came with lessons left (the change that keeps it going), the plan is
 * finished, the plan no longer fits, the learner is behind, what their time fits or covers (see
 * `useTimeItems`), a free exam plan's week is over. A finished plan whose time left part of the
 * goal out offers the rest before the next level, as a unit is finished before the next one.
 */
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

/**
 * Holds the Plan's one slot for suggestions: what it could say, which one shows ("1 of 3"), what
 * the learner put off ("Not now"), a change's preview and an answer's result. The slot shows in
 * two places, the line in the page's column under 72rem and the panel in the aside from 72rem
 * (see `PlanSuggestionSlot`); both read this one state, so an answer given in one is the other's.
 */
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

  // An answer's result stays a moment with its Undo; then the slot moves on to what's left. Keep
  // Undo under focus or the pointer.
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

/**
 * The plan no longer fits, said once (the panel's title is its sentence), with Adjust plan; or the
 * learner is behind, with the fix in a sentence and Today, which puts what's behind first.
 */
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

/** A free exam plan past its first week: what stays free, and what Plus opens. */
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

/**
 * The Plan's one slot for what it wants the learner to know or decide, one thing at a time (see
 * `PlanSuggestionProvider`): a line in the page's column under 72rem and a panel in the aside from
 * it, so the page draws it twice and `className` shows each in its place. Under 72rem the pager
 * sits under the line: "Adjust" or "Resume" act from the line itself, and the next thing to say
 * waited behind a sheet that never opened. An answer's result shows where the answers were, with
 * Undo, until the slot moves on.
 */
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
