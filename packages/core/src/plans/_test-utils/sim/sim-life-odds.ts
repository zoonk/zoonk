import { type SimFixtureName } from "./sim-fixture";
import { type SimLife, type SimLifeStep, type SimOperationSpec } from "./sim-life-plan";

/**
 * How likely each thing in a simulated learner's life is (see \`generateSimLife\`): who they are,
 * which step comes next and which change they ask for. Each draws in a fixed order, so changing a
 * number changes the lives of every seed.
 */

/** One outcome of a draw and how likely it is against the others (1 unless it says). */
export type Choice<T> = { value: T; weight?: number };

/** Whole numbers from `least` to `most`, both included. */
export type Range = { least: number; most: number };

/** A kind of goal: the daily time its learners pick, how far its date is, how long a life runs. */
type SimProfile = { minutes: Choice<number>[]; steps: Range; target: Range | null };

export const PROFILES: Record<SimFixtureName, SimProfile> = {
  camara: {
    minutes: [{ value: 60 }, { value: 120 }, { value: 180 }, { value: 240 }],
    steps: { least: 12, most: 22 },
    target: { least: 45, most: 120 },
  },
  career: {
    minutes: [{ value: 15 }, { value: 30 }, { value: 45 }, { value: 60 }],
    steps: { least: 14, most: 26 },
    target: { least: 90, most: 240 },
  },
  "class-test": {
    minutes: [{ value: 15 }, { value: 20 }, { value: 30 }, { value: 45 }],
    steps: { least: 6, most: 14 },
    target: { least: 3, most: 14 },
  },
  enem: {
    minutes: [{ value: 60 }, { value: 120 }, { value: 180 }],
    steps: { least: 12, most: 22 },
    target: { least: 26, most: 60 },
  },
  ielts: {
    minutes: [{ value: 20 }, { value: 30 }, { value: 60 }],
    steps: { least: 8, most: 18 },
    target: { least: 20, most: 90 },
  },
  language: {
    minutes: [{ value: 15 }, { value: 25 }, { value: 45 }],
    steps: { least: 14, most: 26 },
    target: { least: 60, most: 200 },
  },
  oab: {
    minutes: [{ value: 60 }, { value: 120 }, { value: 170 }],
    steps: { least: 12, most: 22 },
    target: { least: 60, most: 150 },
  },
};

/** How a learner answers Today's proposals: as their life says, or not at all ("wait"). */
type ProposalAnswer = NonNullable<SimLife["proposals"]> | "wait";

/** How a learner answers a finished mock's offer: as their life says, or not at all ("leave"). */
type MockOfferAnswer = NonNullable<SimLife["mockOffers"]> | "leave";

/** The level a learner states in onboarding, or none ("unstated"). */
type OwnLevelAnswer = NonNullable<SimLife["ownLevel"]> | "unstated";

/** Who the learner is, as likely as these: their goal's date, placement, what they say they know. */
export const LEARNER_ODDS = {
  /** An exam learner says they know an area in onboarding. */
  claimsKnownArea: 0.4,
  /** A goal that isn't an exam has a date. */
  dated: 0.7,
  /** What the learner says to a finished mock's offer ("leave": nothing). */
  mockOffers: [{ value: "skip" }, { value: "focus" }, { value: "leave" }],
  /**
   * The level an exam learner with listening skills states in onboarding; most who sit IELTS
   * studied English before.
   */
  ownLevel: [
    { value: "unstated" },
    { value: "none" },
    { value: "basic" },
    { value: "intermediate", weight: 3 },
    { value: "advanced", weight: 2 },
  ],
  /** Each skill's lessons aren't outlined yet when the life starts. */
  pendingSkill: 0.15,
  placementAnswers: { least: 3, most: 12 },
  /** How the learner answers Today's proposal to move the phase dates ("wait": not at all). */
  proposals: [{ value: "apply" }, { value: "decline" }, { value: "wait" }],
  /** A placement answer is right. */
  rightAnswer: 0.55,
  /** How long the learner takes against lesson estimates. */
  speed: [{ value: 0.8 }, { value: 1, weight: 2 }, { value: 1.2 }, { value: 1.5 }],
  subscribed: 0.3,
  /** An exam learner takes placement first. */
  takesPlacement: 0.8,
} satisfies Record<
  string,
  Choice<MockOfferAnswer | number | OwnLevelAnswer | ProposalAnswer>[] | Range | number
>;

/** How likely each next step of a life is, and how each one goes. */
export const STEP_ODDS = {
  /** A change goes through the buddy (else the plan editor). */
  buddy: 0.5,
  kinds: [
    { value: "study", weight: 55 },
    { value: "miss", weight: 12 },
    { value: "change", weight: 15 },
    { value: "land", weight: 10 },
    { value: "refresh", weight: 8 },
  ],
  landed: { least: 1, most: 3 },
  missedDays: { least: 1, most: 3 },
  /** A study day misses a question. */
  missesQuestion: 0.3,
  /** How much of the day's session the learner finishes. */
  share: [{ value: 1, weight: 3 }, { value: 0.5 }, { value: 0.75 }, { value: 0.25 }, { value: 0 }],
  /** The learner undoes a change, or placement's test-outs, right away. */
  undo: 0.15,
} satisfies Record<string, Choice<number | SimLifeStep["kind"]>[] | Range | number>;

/**
 * How likely each change is (focus and less of an area are what learners ask the buddy most), and
 * the numbers it takes.
 */
export const CHANGE_ODDS = {
  /** Which of the plan's bases a change of how to study one names. */
  base: { least: 0, most: 5 },
  /** Days a change of date moves it by. */
  dateDays: [{ value: -14 }, { value: -7 }, { value: 7 }, { value: 14 }, { value: 30 }],
  /** A focus also asks for less of another area. */
  focusWithLess: 0.4,
  /** A change of the full course turns it on. */
  fullCourseOn: 0.7,
  kinds: [
    { value: "focus", weight: 7 },
    { value: "reduce", weight: 3 },
    { value: "time", weight: 2 },
    { value: "date", weight: 2 },
    { value: "bases", weight: 2 },
    { value: "restDay" },
    { value: "lightWeek" },
    { value: "fullCourse" },
    { value: "skip" },
    { value: "restore" },
    { value: "pastBasics" },
    { value: "practice" },
  ],
  /** Days from today a light week starts. */
  lightWeekStart: { least: 0, most: 21 },
  /** Daily minutes a change of time asks for. */
  minutes: [
    { value: 15 },
    { value: 30 },
    { value: 45 },
    { value: 60 },
    { value: 90 },
    { value: 120 },
    { value: 180 },
  ],
  restWeekday: { least: 0, most: 6 },
} satisfies Record<string, Choice<number | SimOperationSpec["kind"]>[] | Range | number>;
