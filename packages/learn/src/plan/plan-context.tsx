"use client";

import { type PlanBasesAdvice } from "@zoonk/core/plans/bases-advice-contract";
import {
  type LearnerPlanOperation,
  type PlanChangeDecisionInput,
} from "@zoonk/core/plans/contract";
import { type PlanChangePreview } from "@zoonk/core/plans/preview-contract";
import { type PlanTimeToCover } from "@zoonk/core/plans/time-advice-contract";
import { type ToolChoice, type ToolSystem } from "@zoonk/core/plans/tools-contract";
import { type PlanChangeView, type PlanView } from "@zoonk/core/plans/view-contract";
import { createContext, use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isFocusLost } from "../_utils/is-focus-lost";
import { type LearnBuddy } from "../buddies/use-buddy-name";
import { getTimeToCoverRevision } from "./time-to-cover-revision";

/** `change` is null while the plan isn't built yet. */
export type PlanChangeOutcome =
  | { change: PlanChangeView | null; status: "applied" }
  | { reason: "alreadyIn" | "cantMove"; status: "unchanged" };

/** Each action resolves to what it did, or null when it didn't work. */
export type PlanActions = {
  change: (operations: LearnerPlanOperation[]) => Promise<PlanChangeOutcome | null>;
  /** Nothing is saved. */
  preview: (operations: LearnerPlanOperation[]) => Promise<PlanChangePreview | null>;
  /**
   * Nothing is saved and the plan isn't read again, so the page and its prefetched links stay as
   * they are.
   */
  findTimeToCover: () => Promise<PlanTimeToCover | null>;
  adviseOnBases: () => Promise<PlanBasesAdvice | null>;
  decide: (input: {
    changeId: string;
    status: PlanChangeDecisionInput["status"];
  }) => Promise<boolean>;
  /** The change it made: null when the pick changed nothing or the plan isn't built yet. */
  chooseExamOption: (input: {
    group: string;
    subject: string;
  }) => Promise<{ change: PlanChangeView | null } | null>;
  chooseTools: (input: {
    choice: ToolChoice;
    system: ToolSystem | null;
    tools: string[];
  }) => Promise<boolean>;
};

/** A null `buddy` uses the default buddy. */
export type PlanTutor = { buddy: Pick<LearnBuddy, "kind" | "name"> | null; href: string };

export type PlanGoal = { kind: "exam" | "explain" | "language" | "learn"; title: string };

type PlanScreenValue = {
  actions: PlanActions;
  goal: PlanGoal;
  tutor?: PlanTutor;
  plan: PlanView;
  focusTestHref?: string;
  openFocus?: boolean;
  /** A path on the host; sharing adds the origin. */
  shareHref: string;
};

type TimeToCoverState =
  | { status: "idle" }
  | { revision: string; status: "building" | "failed" | "pending" }
  | { revision: string; status: "answered"; time: PlanTimeToCover };

type TimeToCoverSearch = { promise: Promise<PlanTimeToCover | null>; revision: string };

type FindOutcome =
  | { status: "answered"; time: PlanTimeToCover }
  | { status: "building" | "failed" | "stale" };

type TimeToCoverStore = {
  find: (request: () => Promise<PlanTimeToCover | null>) => Promise<FindOutcome>;
  state: TimeToCoverState;
};

export const PLAN_TITLE_ID = "plan-title";

type FocusTarget = () => HTMLElement | null;

/** Read it in handlers, never while rendering. */
type PlanChanges = { isSaving: () => boolean };

type PlanScreenContextValue = PlanScreenValue & {
  /** The learner's day as core marked it, so the server's render and hydration agree. */
  today: string;
  changes: PlanChanges;
  timeToCover: TimeToCoverStore;
  /**
   * Call as a save starts: if the save takes the focused control away, focus moves to `target` or
   * the plan's title.
   */
  keepFocus: (target?: FocusTarget) => void;
};

type Saving = { control: Element | null; plan: PlanView; target?: FocusTarget };

export const PlanScreenContext = createContext<PlanScreenContextValue | null>(null);

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

    if (saved.control && !saved.control.isConnected && isFocusLost(document.activeElement)) {
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

const IDLE: TimeToCoverState = { status: "idle" };

function useTimeToCoverStore(plan: PlanView): TimeToCoverStore {
  const revision = useMemo(() => getTimeToCoverRevision(plan), [plan]);
  const [stored, setStored] = useState<TimeToCoverState>(IDLE);
  const latest = useRef(revision);
  const search = useRef<TimeToCoverSearch | null>(null);
  const state = stored.status !== "idle" && stored.revision === revision ? stored : IDLE;

  useEffect(() => {
    latest.current = revision;
  }, [revision]);

  const settle = (promise: Promise<PlanTimeToCover | null>) =>
    void promise.then((time) => {
      if (search.current?.promise === promise) {
        search.current = null;
      }

      const next: TimeToCoverState = time?.ready
        ? { revision, status: "answered", time }
        : { revision, status: time ? "building" : "failed" };

      setStored((current) =>
        current.status === "pending" && current.revision === revision ? next : current,
      );
    });

  const find = async (request: () => Promise<PlanTimeToCover | null>): Promise<FindOutcome> => {
    if (state.status === "answered") {
      return { status: "answered", time: state.time };
    }

    const running = search.current?.revision === revision ? search.current.promise : null;
    const promise = running ?? request();

    if (!running) {
      search.current = { promise, revision };
      setStored({ revision, status: "pending" });
      settle(promise);
    }

    const time = await promise;

    if (latest.current !== revision) {
      return { status: "stale" };
    }

    return time?.ready ? { status: "answered", time } : { status: time ? "building" : "failed" };
  };

  return { find, state };
}

/**
 * A ref, not state: a save starts inside its transition, where a state update would only show once
 * it's done.
 */
function useCountedChanges(actions: PlanActions): { actions: PlanActions; changes: PlanChanges } {
  const saving = useRef(0);

  const countedActions = useMemo((): PlanActions => {
    const counted = <Result,>(save: () => Promise<Result>): Promise<Result> => {
      saving.current += 1;

      return save().finally(() => {
        saving.current -= 1;
      });
    };

    return {
      ...actions,
      change: (operations) => counted(() => actions.change(operations)),
      chooseExamOption: (input) => counted(() => actions.chooseExamOption(input)),
      chooseTools: (input) => counted(() => actions.chooseTools(input)),
      decide: (input) =>
        input.status === "applied" || input.status === "undone"
          ? counted(() => actions.decide(input))
          : actions.decide(input),
    };
  }, [actions]);

  const changes = useMemo(() => ({ isSaving: () => saving.current > 0 }), []);

  return { actions: countedActions, changes };
}

export function PlanScreenProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: PlanScreenValue;
}) {
  const today =
    value.plan.week.days.find((day) => day.state === "today")?.date ?? value.plan.week.startDate;

  const keepFocus = useKeepFocus(value.plan);
  const timeToCover = useTimeToCoverStore(value.plan);
  const { actions, changes } = useCountedChanges(value.actions);

  return (
    <PlanScreenContext value={{ ...value, actions, changes, keepFocus, timeToCover, today }}>
      {children}
    </PlanScreenContext>
  );
}

export function usePlanScreen(): PlanScreenContextValue {
  const value = use(PlanScreenContext);

  if (!value) {
    throw new Error("Plan components must be used within PlanScreen");
  }

  return value;
}
