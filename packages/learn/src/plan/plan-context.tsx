"use client";

import {
  type LearnerPlanOperation,
  type PlanChangeDecisionInput,
} from "@zoonk/core/plans/contract";
import { type ToolChoice, type ToolSystem } from "@zoonk/core/plans/tools-contract";
import { type PlanChangeView, type PlanView } from "@zoonk/core/plans/view-contract";
import { createContext, use, useCallback, useEffect, useRef } from "react";
import { type LearnBuddy } from "../buddies/use-buddy-name";

/**
 * What a change did: applied (with the change, null while the plan isn't built yet), or for a focus
 * that would move nothing, unchanged with why: its subjects already have every lesson in the plan
 * (`alreadyIn`), or already start as early as what they build on allows (`cantMove`).
 */
export type PlanChangeOutcome =
  | { change: PlanChangeView | null; status: "applied" }
  | { reason: "alreadyIn" | "cantMove"; status: "unchanged" };

/**
 * The host saves every change through core and re-renders the plan. Each action resolves to
 * whether it worked (a change, to what it did, or null when it didn't), so the screen can say so
 * without knowing how the host talks to core.
 */
export type PlanActions = {
  change: (operations: LearnerPlanOperation[]) => Promise<PlanChangeOutcome | null>;
  decide: (input: {
    changeId: string;
    status: PlanChangeDecisionInput["status"];
  }) => Promise<boolean>;
  /** The learner's answer for these tools, from the plan editor. */
  chooseTools: (input: {
    choice: ToolChoice;
    system: ToolSystem | null;
    tools: string[];
  }) => Promise<boolean>;
};

/** The buddy's conversation, by its tab's link and the buddy that answers (null before one). */
export type PlanTutor = { buddy: Pick<LearnBuddy, "kind" | "name"> | null; href: string };

/** The goal as the plan's screens name it. */
export type PlanGoal = { kind: "exam" | "explain" | "language" | "learn"; title: string };

type PlanScreenValue = {
  actions: PlanActions;
  goal: PlanGoal;
  /**
   * The learner's buddy, their tutor for the goal, where questions about the plan and changes in
   * their own words go; hosts without the buddy's conversation leave it out.
   */
  tutor?: PlanTutor;
  plan: PlanView;
  /**
   * The focus test's page on the host, where answers choose where the plan's depth goes; hosts
   * without it leave it out, and only choosing by hand is offered.
   */
  focusTestHref?: string;
  /**
   * The host opened the plan to choose where to focus (the buddy offered it): "Choose where to
   * focus" opens on arrival.
   */
  openFocus?: boolean;
  /** The plan's link, as a path on the host (the origin is added when sharing). */
  shareHref: string;
};

/** Where focus goes when a save takes its control away and nothing closer can take it. */
export const PLAN_TITLE_ID = "plan-title";

/** Where focus should land if the control that saved is gone; null falls back to the plan's title. */
type FocusTarget = () => HTMLElement | null;

type PlanScreenContextValue = PlanScreenValue & {
  /**
   * Call as a save starts. If the save takes the focused control away (an answered change leaves,
   * a tool's choice replaces its button), focus moves to `target` or the plan's title once the saved
   * plan shows, instead of to the page.
   */
  keepFocus: (target?: FocusTarget) => void;
};

type Saving = { control: Element | null; plan: PlanView; target?: FocusTarget };

const PlanScreenContext = createContext<PlanScreenContextValue | null>(null);

/**
 * Focus is lost when it fell to the page, or, inside a sheet (the plan editor), to the sheet
 * itself: the dialog takes focus back when its focused control leaves.
 */
function isFocusLost(): boolean {
  const active = document.activeElement;
  return !active || active === document.body || active.getAttribute("role") === "dialog";
}

function findFallback(target?: FocusTarget): HTMLElement | null {
  return target?.() ?? document.querySelector<HTMLElement>(`#${PLAN_TITLE_ID}`);
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
