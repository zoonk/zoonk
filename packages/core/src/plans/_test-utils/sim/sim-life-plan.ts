import { createHash } from "node:crypto";
import { type OwnLevel } from "../../../learner/placement/placement-steps";
import { getSkillArea } from "../../planner/graph-areas";
import {
  BASE_CHOICES,
  type BaseChoice,
  PRACTICE_BIASES,
  type PracticeBias,
} from "../../planner/plan-state";
import { type SimFixtureName } from "./sim-fixture";
import { type SimInputs, loadSimInputs } from "./sim-inputs";
import {
  CHANGE_ODDS,
  type Choice,
  LEARNER_ODDS,
  PROFILES,
  type Range,
  STEP_ODDS,
} from "./sim-life-odds";

/**
 * A change the simulated learner asks for, by the buddy's real operations, with areas, bases and
 * dates relative to the library and the plan, so a life stays valid when shrinking removes steps.
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
  /**
   * A study day: the share of the session the learner finishes, and the skills (by index) whose
   * questions they get wrong, which only the database tier's question bank asks.
   */
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
   * What the learner says to a finished mock's offer (a Plus exam learner, database tier): skip the
   * lessons of the topics it showed they know, or give the area that went worst more time. Without
   * it they leave the offer.
   */
  mockOffers?: "focus" | "skip";
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

/**
 * A draw in [0, 1) from a seed, a stream and a counter: the same sequence everywhere, on any
 * machine. A stream of its own draws without moving the main one's sequence.
 */
function draw({ count, seed, stream }: { count: number; seed: number; stream?: string }): number {
  const key = stream ? `${seed}:${stream}:${count}` : `${seed}:${count}`;
  return createHash("sha1").update(key).digest().readUInt32BE(0) / UINT32_RANGE;
}

const UINT32_RANGE = 4_294_967_296;

/** A seeded random source for a life, or for one `stream` of its draws. */
function createRandom(seed: number, stream?: string) {
  const state = { count: 0 };

  const next = () => {
    state.count += 1;
    return draw({ count: state.count, seed, stream });
  };

  const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1));

  const pick = <T>(list: readonly T[]): T => {
    const value = list[Math.floor(next() * list.length)];

    if (value === undefined) {
      throw new Error("Picked from an empty list");
    }

    return value;
  };

  /** One of the choices' values, each as likely as its weight. */
  const choose = <T>(choices: readonly Choice<T>[]): T => {
    const weights = choices.map((choice) => choice.weight ?? 1);
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    const roll = next() * total;

    const ends = weights.map(
      (weight, index) =>
        weight + weights.slice(0, index).reduce((sum, earlier) => sum + earlier, 0),
    );

    const found = choices[ends.findIndex((end) => roll < end)] ?? choices.at(-1);

    if (!found) {
      throw new Error("Chose from an empty list");
    }

    return found.value;
  };

  return {
    between: (range: Range) => int(range.least, range.most),
    chance: (probability: number) => next() < probability,
    choose,
    int,
    pick,
  };
}

type Random = ReturnType<typeof createRandom>;

const START = "2026-10-12";

export function listAreas(inputs: Pick<SimInputs, "library">): string[] {
  const { graph } = inputs.library;
  return [...new Set(graph.skills.map((skill) => getSkillArea({ graph, skill })))];
}

function generateSpec({ areas, random }: { areas: number; random: Random }): SimOperationSpec {
  const area = random.int(0, Math.max(0, areas - 1));
  const other = random.int(0, Math.max(0, areas - 1));
  const kind = random.choose(CHANGE_ODDS.kinds);

  const specs: Record<SimOperationSpec["kind"], () => SimOperationSpec> = {
    bases: () => ({
      base: random.between(CHANGE_ODDS.base),
      choice: random.pick(BASE_CHOICES),
      kind: "bases",
    }),
    date: () => ({ days: random.choose(CHANGE_ODDS.dateDays), kind: "date" }),
    focus: () => ({
      area,
      kind: "focus",
      ...(random.chance(CHANGE_ODDS.focusWithLess) && other !== area && { less: other }),
    }),
    fullCourse: () => ({ kind: "fullCourse", on: random.chance(CHANGE_ODDS.fullCourseOn) }),
    lightWeek: () => ({ inDays: random.between(CHANGE_ODDS.lightWeekStart), kind: "lightWeek" }),
    pastBasics: () => ({ area, kind: "pastBasics" }),
    practice: () => ({ bias: random.pick(PRACTICE_BIASES), kind: "practice" }),
    reduce: () => ({ area, kind: "reduce" }),
    restDay: () => ({ kind: "restDay", weekday: random.between(CHANGE_ODDS.restWeekday) }),
    restore: () => ({ area, kind: "restore" }),
    skip: () => ({ area, kind: "skip" }),
    time: () => ({ kind: "time", minutes: random.choose(CHANGE_ODDS.minutes) }),
  };

  return specs[kind]();
}

function generateStep({
  areas,
  random,
  skills,
}: {
  areas: number;
  random: Random;
  skills: number;
}): SimLifeStep {
  const kind = random.choose(STEP_ODDS.kinds);

  const steps: Record<SimLifeStep["kind"], () => SimLifeStep> = {
    change: () => ({
      kind: "change",
      spec: generateSpec({ areas, random }),
      via: random.chance(STEP_ODDS.buddy) ? "buddy" : "editor",
    }),
    land: () => ({ count: random.between(STEP_ODDS.landed), kind: "land" }),
    miss: () => ({ days: random.between(STEP_ODDS.missedDays), kind: "miss" }),
    placement: () => ({ answers: [], kind: "placement" }),
    refresh: () => ({ kind: "refresh" }),
    study: () => ({
      finish: random.choose(STEP_ODDS.share),
      kind: "study",
      misses: random.chance(STEP_ODDS.missesQuestion) ? [random.int(0, skills - 1)] : [],
    }),
  };

  return steps[kind]();
}

/** A change that gives one area more or less time than the others. */
function isAreaSteering(step: SimLifeStep): boolean {
  return step.kind === "change" && (step.spec.kind === "focus" || step.spec.kind === "reduce");
}

/** A seeded learner's life on a fixture. */
export async function generateSimLife({
  fixture,
  seed,
}: {
  fixture: SimFixtureName;
  seed: number;
}): Promise<SimLife> {
  const inputs = await loadSimInputs(fixture);
  const random = createRandom(seed);
  const profile = PROFILES[fixture];
  const skills = inputs.library.graph.skills.length;
  const areas = listAreas(inputs).length;
  const isExam = inputs.goal.kind === "exam";

  const targetInDays =
    profile.target && (isExam || random.chance(LEARNER_ODDS.dated))
      ? random.between(profile.target)
      : null;

  const pending = Array.from({ length: skills }, (_, index) => index).filter(() =>
    random.chance(LEARNER_ODDS.pendingSkill),
  );

  const placement: SimLifeStep[] =
    isExam && random.chance(LEARNER_ODDS.takesPlacement)
      ? [
          {
            answers: Array.from({ length: random.between(LEARNER_ODDS.placementAnswers) }, () => [
              random.int(0, skills - 1),
              random.chance(LEARNER_ODDS.rightAnswer),
            ]),
            kind: "placement",
          },
        ]
      : [];

  const length = random.between(profile.steps);

  // Undos draw from a stream of their own, so every other draw stays what it was before them.
  const undos = createRandom(seed, "undo");

  const steps = [
    ...placement,
    ...Array.from({ length: Math.max(0, length - placement.length) }, () =>
      generateStep({ areas, random, skills }),
    ),
  ]
    .map((step) =>
      (step.kind === "change" || step.kind === "placement") && undos.chance(STEP_ODDS.undo)
        ? { ...step, undo: true as const }
        : step,
    )
    // Focus and "less" weigh one area against others: neither the editor nor the buddy offers them
    // for a goal with one area. Dropped after every draw, so the rest of the life stays the same.
    .filter((step) => areas > 1 || !isAreaSteering(step));

  // The fields draw in this order: a life is the same for a seed as long as it stays.
  const life: SimLife = {
    dailyMinutes: random.choose(profile.minutes),
    fixture,
    knownAreas:
      isExam && random.chance(LEARNER_ODDS.claimsKnownArea) ? [random.int(0, areas - 1)] : [],
    pending,
    seed,
    speed: random.choose(LEARNER_ODDS.speed),
    start: START,
    steps,
    subscribed: random.chance(LEARNER_ODDS.subscribed),
    targetInDays,
  };

  // Drawn last, so every draw before them stays what it was before learners answered proposals and
  // mocks' offers.
  const proposals = random.choose(LEARNER_ODDS.proposals);
  const mockOffers = random.choose(LEARNER_ODDS.mockOffers);

  // A stream of its own, so lives without listening stay what they were before learners stated it.
  const ownLevel =
    inputs.listeningSkillIds.size > 0
      ? createRandom(seed, "level").choose(LEARNER_ODDS.ownLevel)
      : "unstated";

  return {
    ...life,
    ...(proposals !== "wait" && { proposals }),
    ...(mockOffers !== "leave" && { mockOffers }),
    ...(ownLevel !== "unstated" && { ownLevel }),
  };
}
