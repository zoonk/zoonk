"use client";

import {
  type LearnerPlanOperation,
  type PlanChangeDecisionInput,
} from "@zoonk/core/plans/contract";
import { type OwnLevelChange } from "@zoonk/core/plans/own-level-contract";
import { type ToolChoice, type ToolSystem } from "@zoonk/core/plans/tools-contract";
import { type PlanView } from "@zoonk/core/plans/view-contract";
import { createContext, use, useCallback, useEffect, useRef } from "react";
import { type HelpLimit } from "../_components/help-limit-notice";

/**
 * What happened to a request in plain words: applied now, waiting for OK, not understood, or not
 * read because the learner's small AI help needs a short break or is used up for today.
 */
export type PlanEditOutcome =
  | { status: "applied" | "failed" | "notUnderstood" | "proposed" }
  | HelpLimit;

/**
 * The host saves every change through core and re-renders the plan. Each action resolves to
 * whether it worked, so the screen can say so without knowing how the host talks to core.
 */
export type PlanActions = {
  change: (operations: LearnerPlanOperation[]) => Promise<boolean>;
  decide: (input: {
    changeId: string;
    status: PlanChangeDecisionInput["status"];
  }) => Promise<boolean>;
  requestEdit: (text: string) => Promise<PlanEditOutcome>;
  /** The learner's answer on the "You'll use" card for these tools. */
  chooseTools: (input: {
    choice: ToolChoice;
    system: ToolSystem | null;
    tools: string[];
  }) => Promise<boolean>;
  /**
   * Changes the learner's own level from the plan; null when it didn't work. Hosts without it
   * (the plan reveal) don't show the level control.
   */
  changeLevel?: (level: OwnLevelChange["level"]) => Promise<OwnLevelChange | null>;
};

/** The goal as the plan's header shows it. */
export type PlanGoal = { kind: "exam" | "explain" | "language" | "learn"; title: string };

type PlanScreenValue = {
  actions: PlanActions;
  /** Where a chapter's page lives: the chapter id is appended. Chapters aren't links without it. */
  chapterBasePath?: string;
  /** The public page of the course the plan is built from, for "See full course". */
  courseHref?: string | null;
  goal: PlanGoal;
  /** The map of the goal's subject, with what to study next once the plan is done. */
  mapHref?: string;
  plan: PlanView;
  /** The plan's link, as a path on the host (the origin is added when sharing). */
  shareHref: string;
  /** Where a chapter's test-out lives: the chapter id is appended. */
  testOutBasePath: string;
  /** The host's "Ask" about the plan ("Why am I studying this today?") and the course it's built from. */
  tutor?: React.ReactNode;
};

/** Where focus goes when a save takes its control away: the plan's changes, then its title. */
export const PLAN_CHANGES_TITLE_ID = "plan-changes-title";
export const PLAN_TITLE_ID = "plan-title";

/** Where focus should land if the control that saved is gone; null falls back to the plan's changes. */
type FocusTarget = () => HTMLElement | null;

type PlanScreenContextValue = PlanScreenValue & {
  /**
   * Call as a save starts. If the save takes the focused control away (Apply turns into Undo, a
   * declined proposal leaves the list, a fix the plan no longer needs goes away), focus moves to
   * `target`, the plan's changes or its title once the saved plan shows, instead of to the page.
   */
  keepFocus: (target?: FocusTarget) => void;
};

type Saving = { control: Element | null; plan: PlanView; target?: FocusTarget };

const PlanScreenContext = createContext<PlanScreenContextValue | null>(null);

function isFocusLost(): boolean {
  return !document.activeElement || document.activeElement === document.body;
}

function findFallback(target?: FocusTarget): HTMLElement | null {
  return (
    target?.() ??
    document.querySelector<HTMLElement>(`#${PLAN_CHANGES_TITLE_ID}`) ??
    document.querySelector<HTMLElement>(`#${PLAN_TITLE_ID}`)
  );
}

function useKeepFocus(plan: PlanView) {
  const saving = useRef<Saving | null>(null);

  // The saved plan arrives as a new view model, in the same render that removes the control.
  useEffect(() => {
    const saved = saving.current;

    if (!saved || saved.plan === plan) {
      return;
    }

    saving.current = null;

    if (saved.control && !saved.control.isConnected && isFocusLost()) {
      findFallback(saved.target)?.focus();
    }
  }, [plan]);

  return useCallback(
    (target?: FocusTarget) => {
      saving.current = { control: document.activeElement, plan, target };
    },
    [plan],
  );
}

export function PlanScreenProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: PlanScreenValue;
}) {
  const keepFocus = useKeepFocus(value.plan);

  return <PlanScreenContext value={{ ...value, keepFocus }}>{children}</PlanScreenContext>;
}

export function usePlanScreen(): PlanScreenContextValue {
  const value = use(PlanScreenContext);

  if (!value) {
    throw new Error("Plan components must be used within PlanScreen");
  }

  return value;
}
