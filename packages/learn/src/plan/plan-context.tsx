"use client";

import { type PlanBasesAdvice } from "@zoonk/core/plans/bases-advice-contract";
import {
  type LearnerPlanOperation,
  type PlanChangeDecisionInput,
} from "@zoonk/core/plans/contract";
import { type PlanChangePreview } from "@zoonk/core/plans/preview-contract";
import { type PlanTimeToCover } from "@zoonk/core/plans/time-advice-contract";
import { type ToolChoice, type ToolSystem } from "@zoonk/core/plans/tools-contract";
import { type PlanChangeView, type PlanScreenView } from "@zoonk/core/plans/view-contract";
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { type LearnBuddy } from "../buddies/use-buddy-name";
import { getTimeToCoverRevision } from "./time-to-cover-revision";

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
  /** What a change would do before the learner makes it; nothing is saved. Null when it failed. */
  preview: (operations: LearnerPlanOperation[]) => Promise<PlanChangePreview | null>;
  /**
   * The daily time that covers the whole goal by its date in the plan's own week, and for a goal
   * that isn't an exam the date its time covers everything by, found when the learner taps "Find
   * the time that covers everything" (see `PlanTimeToCover`). Nothing is saved and the plan isn't
   * read again, so the page and its prefetched links stay as they are. Null when it failed.
   */
  findTimeToCover: () => Promise<PlanTimeToCover | null>;
  /** What the app recommends for the plan's bases, when the learner asks; null when it failed. */
  adviseOnBases: () => Promise<PlanBasesAdvice | null>;
  decide: (input: {
    changeId: string;
    status: PlanChangeDecisionInput["status"];
  }) => Promise<boolean>;
  /**
   * The option the learner takes of one of their exam's choices, from the plan editor: the change
   * it made (null when the pick changed nothing, or the plan isn't built yet), or null when it
   * didn't work.
   */
  chooseExamOption: (input: {
    group: string;
    subject: string;
  }) => Promise<{ change: PlanChangeView | null } | null>;
  /** The learner's answer for these tools, from the plan editor. */
  chooseTools: (input: {
    choice: ToolChoice;
    system: ToolSystem | null;
    tools: string[];
  }) => Promise<boolean>;
};

/** The buddy's conversation, by its tab's link and its identity; null uses the default buddy. */
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
  plan: PlanScreenView;
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

/**
 * The learner's "Find the time that covers everything" for the plan as it is now: asked, waiting,
 * answered, failed, or found the plan being built again. It belongs to the plan it was found for
 * (its `generation`, see `getTimeToCoverRevision`): any change to what it searched (the plan's
 * time, days, date, focus, bases or exam choices) leaves it behind for good, and Find shows again
 * while the plan still falls short.
 */
type TimeToCoverState =
  | { status: "idle" }
  | { generation: number; status: "building" | "failed" | "pending" }
  | { generation: number; status: "answered"; time: PlanTimeToCover };

/** The search still running for a revision: asking again waits for it instead of searching. */
type TimeToCoverSearch = { generation: number; promise: Promise<PlanTimeToCover | null> };

/**
 * How a find ended for the one who asked: the answer, the plan being built, a failure, or a plan
 * that changed while it searched (`stale`), whose answer is for a plan no longer shown.
 */
type FindOutcome =
  | { status: "answered"; time: PlanTimeToCover }
  | { status: "building" | "failed" | "stale" };

/** The find answer the Plan's card, editor and moves share, since they ask the same question. */
type TimeToCoverStore = {
  /**
   * Asks for the time that covers the plan as it is now (`request`), once per revision: asked
   * again while it runs, it waits for that search; once answered, it gives that answer.
   */
  find: (request: () => Promise<PlanTimeToCover | null>) => Promise<FindOutcome>;
  state: TimeToCoverState;
};

/** Where focus goes when a save takes its control away and nothing closer can take it. */
export const PLAN_TITLE_ID = "plan-title";

/** Where focus should land if the control that saved is gone; null falls back to the plan's title. */
type FocusTarget = () => HTMLElement | null;

/**
 * The plan's changes, whichever control saves them (every save goes through `actions`): whether one
 * is saving, and how many ever started. A change worked out before it saves (Move your date finds
 * its date first) can tell another one started meanwhile, and leave the plan to it.
 */
type PlanChanges = {
  /** Whether a change is saving right now, for handlers: current before the screen shows it. */
  isSaving: () => boolean;
  /** Whether a change is saving, as the screen shows it. */
  saving: boolean;
  /** How many changes started so far: read it in handlers, never while rendering. */
  started: () => number;
  /** Hears each change start and answer, for what waits on them outside a render. */
  subscribe: (listener: () => void) => () => void;
};

type PlanScreenContextValue = PlanScreenValue & {
  changes: PlanChanges;
  timeToCover: TimeToCoverStore;
  /**
   * Call as a save starts. If the save takes the focused control away (an answered change leaves,
   * a tool's choice replaces its button), focus moves to `target` or the plan's title once the saved
   * plan shows, instead of to the page.
   */
  keepFocus: (target?: FocusTarget) => void;
};

type Saving = { control: Element | null; plan: PlanScreenView; target?: FocusTarget };

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

function useKeepFocus(plan: PlanScreenView) {
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

const IDLE: TimeToCoverState = { status: "idle" };

/** One find answer for the plan as it is now (see `TimeToCoverState`). */
function useTimeToCoverStore(plan: PlanScreenView): TimeToCoverStore {
  const revision = useMemo(() => getTimeToCoverRevision(plan), [plan]);
  // Each change to what Find searched starts a generation: an answer never comes back with an
  // Undo that restores the plan it was found for, and a search for one never fills another.
  const [seen, setSeen] = useState({ generation: 0, revision });
  const generation = seen.revision === revision ? seen.generation : seen.generation + 1;
  const [stored, setStored] = useState<TimeToCoverState>(IDLE);
  const latest = useRef(generation);
  const search = useRef<TimeToCoverSearch | null>(null);
  const state = stored.status !== "idle" && stored.generation === generation ? stored : IDLE;

  if (seen.revision !== revision) {
    setSeen({ generation, revision });
  }

  useEffect(() => {
    latest.current = generation;
  }, [generation]);

  const settle = (promise: Promise<PlanTimeToCover | null>) =>
    void promise.then((time) => {
      if (search.current?.promise === promise) {
        search.current = null;
      }

      const next: TimeToCoverState = time?.ready
        ? { generation, status: "answered", time }
        : { generation, status: time ? "building" : "failed" };

      setStored((current) =>
        current.status === "pending" && current.generation === generation ? next : current,
      );
    });

  const find = async (request: () => Promise<PlanTimeToCover | null>): Promise<FindOutcome> => {
    if (state.status === "answered") {
      return { status: "answered", time: state.time };
    }

    const running = search.current?.generation === generation ? search.current.promise : null;
    const promise = running ?? request();

    if (!running) {
      search.current = { generation, promise };
      setStored({ generation, status: "pending" });
      settle(promise);
    }

    const time = await promise;

    if (latest.current !== generation) {
      return { status: "stale" };
    }

    return time?.ready ? { status: "answered", time } : { status: time ? "building" : "failed" };
  };

  return { find, state };
}

/** The changes in flight, kept outside React's state (see `useCountedChanges`). */
type ChangeCounter = Pick<PlanChanges, "isSaving" | "started" | "subscribe"> & {
  /** Call as a change starts; call what it returns once it answered, saved or not. */
  begin: () => () => void;
};

function createChangeCounter(): ChangeCounter {
  let started = 0;
  let saving = 0;
  const listeners = new Set<() => void>();

  const notify = () => {
    for (const listener of listeners) {
      listener();
    }
  };

  return {
    begin: () => {
      started += 1;
      saving += 1;
      notify();
      let ended = false;

      return () => {
        if (!ended) {
          ended = true;
          saving -= 1;
          notify();
        }
      };
    },
    isSaving: () => saving > 0,
    started: () => started,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/**
 * The tab's plan changes: a page shows one plan, and a change saving anywhere on it is the one the
 * others wait for. The count only grows, and every change that starts ends, saved or not.
 */
const changeCounter = createChangeCounter();

function counted<Result>(save: () => Promise<Result>): Promise<Result> {
  const end = changeCounter.begin();
  return save().finally(end);
}

/**
 * Counts every action that changes the plan as it starts and answers (see `PlanChanges`): its own
 * changes, an Undo or an Apply, an exam's option, the tools. A store outside React's state, since a
 * save starts inside its transition, where a state update would only show once the save is done.
 */
function useCountedChanges(actions: PlanActions): { actions: PlanActions; changes: PlanChanges } {
  const saving = useSyncExternalStore(changeCounter.subscribe, changeCounter.isSaving, () => false);

  const countedActions = useMemo(
    (): PlanActions => ({
      ...actions,
      change: (operations) => counted(() => actions.change(operations)),
      chooseExamOption: (input) => counted(() => actions.chooseExamOption(input)),
      chooseTools: (input) => counted(() => actions.chooseTools(input)),
      decide: (input) =>
        input.status === "applied" || input.status === "undone"
          ? counted(() => actions.decide(input))
          : actions.decide(input),
    }),
    [actions],
  );

  return {
    actions: countedActions,
    changes: useMemo(
      () => ({
        isSaving: changeCounter.isSaving,
        saving,
        started: changeCounter.started,
        subscribe: changeCounter.subscribe,
      }),
      [saving],
    ),
  };
}

export function PlanScreenProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: PlanScreenValue;
}) {
  const keepFocus = useKeepFocus(value.plan);
  const timeToCover = useTimeToCoverStore(value.plan);
  const { actions, changes } = useCountedChanges(value.actions);

  return (
    <PlanScreenContext value={{ ...value, actions, changes, keepFocus, timeToCover }}>
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
