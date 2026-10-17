import { type OwnLevel } from "../../../learner/placement/placement-steps";
import { getSkillArea } from "../../planner/graph-areas";
import { type BaseChoice, type PracticeBias } from "../../planner/plan-state";
import { type SimFixtureName } from "./sim-fixture";
import { type SimInputs } from "./sim-inputs";

/**
 * A change the simulated learner asks for, by the buddy's real operations, with areas, bases and
 * dates relative to the library and the plan.
 */
export type SimOperationSpec =
  | {
      /** The other areas chosen with it, as the focus sheet sends every area checked. */
      also?: number[];
      area: number;
      kind: "focus";
      less?: number;
    }
  | { area: number; kind: "reduce" }
  | { kind: "time"; minutes: number }
  | { days: number; kind: "date" }
  | { kind: "restDay"; weekday: number }
  | { inDays: number; kind: "lightWeek" }
  | { base: number; choice: BaseChoice; kind: "bases" }
  | { kind: "fullCourse"; on: boolean }
  | { area: number; kind: "skip" }
  | { area: number; kind: "restore" }
  | { area: number; kind: "pastBasics" }
  | { bias: PracticeBias; kind: "practice" };

/**
 * One thing that happens in a learner's life; `study` and `miss` end their days. `undo`: the
 * learner undoes it right away (the change, or the lessons placement's test-outs skipped).
 */
export type SimLifeStep =
  | { answers: [skill: number, correct: boolean][]; kind: "placement"; undo?: true }
  /** A study day: the share of the session the learner finishes. */
  | { finish: number; kind: "study"; misses: number[] }
  | { days: number; kind: "miss" }
  /** The system re-plans with nothing new: a landing for other goals, the lookahead. */
  | { kind: "refresh" }
  | { count: number; kind: "land" }
  | { kind: "change"; spec: SimOperationSpec; undo?: true; via: "buddy" | "editor" };

/** A learner's life: who they are and what they do, from a seed. */
export type SimLife = {
  dailyMinutes: number;
  fixture: SimFixtureName;
  /** Areas (by index among the graph's areas) the learner says they know in onboarding. */
  knownAreas: number[];
  /**
   * The level the learner states in onboarding (`details.level`), drawn for an exam with listening
   * skills: from "intermediate" on, onboarding starts its listening past the basics
   * (`settleNewPlan`). Without it they didn't say.
   */
  ownLevel?: OwnLevel;
  /** Skills (by index in the graph) whose lessons the Library hasn't outlined at the start. */
  pending: number[];
  /**
   * How the learner answers Today's proposal to move the phase dates when they open Today and one
   * waits: apply it, or keep their dates. Without it they leave it waiting.
   */
  proposals?: "apply" | "decline";
  seed: number;
  /** How long the learner takes against lesson estimates (1.2: 20% longer). */
  speed: number;
  start: string;
  steps: SimLifeStep[];
  subscribed: boolean;
  /** Days from the start to the goal's date; null for none. */
  targetInDays: number | null;
};

export function listAreas(inputs: Pick<SimInputs, "library">): string[] {
  const { graph } = inputs.library;
  return [...new Set(graph.skills.map((skill) => getSkillArea({ graph, skill })))];
}
