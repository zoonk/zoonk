import { getSkillArea } from "../../planner/graph-areas";
import { type BaseChoice } from "../../planner/plan-state";
import { type SimFixtureName } from "./sim-fixture";
import { type SimInputs } from "./sim-inputs";

/** A choice of how to study one of the plan's bases (by its index among them), from the editor. */
export type SimOperationSpec = { base: number; choice: BaseChoice; kind: "bases" };

/** One thing that happens in a learner's life; `study` and `miss` end their days. */
export type SimLifeStep =
  | { answers: [skill: number, correct: boolean][]; kind: "placement" }
  /** A study day: the share of the session the learner finishes. */
  | { finish: number; kind: "study"; misses: number[] }
  | { days: number; kind: "miss" }
  /** The system re-plans with nothing new: a landing for other goals, the lookahead. */
  | { kind: "refresh" }
  | { kind: "change"; spec: SimOperationSpec };

/** A learner's life: who they are and what they do, from a seed. */
export type SimLife = {
  dailyMinutes: number;
  fixture: SimFixtureName;
  /** Areas (by index among the graph's areas) the learner says they know in onboarding. */
  knownAreas: number[];
  /** Skills (by index in the graph) whose lessons the Library hasn't outlined at the start. */
  pending: number[];
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
