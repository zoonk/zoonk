/**
 * The named states a screen can be in, shared by the web, Android and Apple (`REPORT-SHAPE.md`).
 * A capture says which scenario it shows; the evaluator fails a scenario a run was asked for and
 * didn't capture, one it doesn't know, and an anchor that moved between the two scenarios of a
 * pair. Whoever adds a branch to a screen (a gate, a limit, a notice, a wait) adds its scenario
 * here; a screen's lane fills in the rest of its own.
 */
type Pointer = "keys" | "touch";

/** Where the screen is and who sees it. `persona` is `pnpm dev:persona`'s name and flags. */
export type Prerequisites = {
  persona: { flags?: string[]; name: string } | "visitor";
  /** A state no persona or step reaches yet: what has to be seeded first. */
  seed?: string;
  /** Values the page keeps on the device, as `verify:pages --local-storage`. */
  storage?: Record<string, string>;
};

/** One step toward the state, in the words a learner sees. */
export type Step =
  | { click: string }
  | { fill: { field: string; value: string } }
  | { press: string }
  | { scroll: "end" }
  | { wait: string };

/** An element a state pair compares: its id is the same on every platform. */
type Anchor = { id: string; web?: string };

export type Scenario = {
  id: string;
  screen: string;
  prerequisites: Prerequisites;
  /** The steps after the screen loads; null when the web can't reach it yet. */
  reach: Step[] | null;
  /** Words on the screen that prove this state is showing. */
  proof: string;
  /**
   * Each configuration to capture. `locale` loads the screen in that language (English when
   * absent); `textScale` sets the browser's default text size to that multiple of 16 px, as a
   * learner's text-size setting does (Android's font scale, Apple's Dynamic Type).
   */
  sizes: { locale?: string; pointer: Pointer; size: string; textScale?: number }[];
  anchors: Anchor[];
  /** The scenario this one is the other half of, and the anchors allowed to change between them. */
  pair?: { change: string[]; with: string };
};

const PHONE_AND_LAPTOP: Scenario["sizes"] = [
  { pointer: "touch", size: "phone" },
  { pointer: "keys", size: "laptop" },
];

const PINNED_ACTION: Anchor = {
  id: "pinned-action",
  web: "[data-slot=task-action-bar], [data-slot=bottom-bar]",
};

const SHEET_FRAME: Anchor = {
  id: "sheet-frame",
  web: "[data-slot=drawer-popup], [data-slot=sheet-content]",
};

export const SCENARIOS: Scenario[] = [
  // The states the owner's catches needed.
  {
    anchors: [],
    id: "plan.path",
    prerequisites: { persona: { name: "maya" } },
    proof: "Your path",
    reach: [],
    screen: "/plan",
    sizes: [
      ...PHONE_AND_LAPTOP,
      { pointer: "touch", size: "tablet" },
      { locale: "de", pointer: "touch", size: "phone" },
      { locale: "ja", pointer: "touch", size: "phone" },
      { pointer: "touch", size: "phone", textScale: 2 },
    ],
  },
  {
    anchors: [],
    id: "plan.path.exam",
    prerequisites: { persona: { name: "ana" } },
    proof: "Your path",
    reach: [],
    screen: "/plan",
    sizes: PHONE_AND_LAPTOP,
  },
  // The "Your path" sheet a phone opens from the roadmap: the exam's row with its date (#1).
  {
    anchors: [SHEET_FRAME],
    id: "plan.path.sheet",
    prerequisites: { persona: { name: "ana" } },
    proof: "Your path",
    reach: [{ click: "Phase 1 of 4" }],
    screen: "/plan",
    sizes: [{ pointer: "touch", size: "phone" }],
  },
  {
    anchors: [],
    id: "settings.conditions.past-nine",
    prerequisites: { persona: { name: "maya" } },
    proof: "Something else",
    reach: [],
    screen: "/settings/about-you/conditions",
    sizes: [...PHONE_AND_LAPTOP, { pointer: "touch", size: "tablet" }],
  },
  {
    anchors: [],
    id: "settings.conditions.end",
    prerequisites: { persona: { name: "maya" } },
    proof: "Tell us in your own words.",
    reach: [{ scroll: "end" }],
    screen: "/settings/about-you/conditions",
    sizes: PHONE_AND_LAPTOP,
  },
  {
    anchors: [],
    id: "catalog.visitor.sidebar",
    prerequisites: { persona: "visitor" },
    proof: "Log in",
    reach: [],
    screen: "/courses",
    sizes: [{ pointer: "keys", size: "laptop" }],
  },
  {
    anchors: [],
    id: "catalog.visitor.sidebar-collapsed",
    prerequisites: { persona: "visitor", storage: { "sidebar-collapsed": "true" } },
    proof: "Courses",
    reach: [],
    screen: "/courses",
    sizes: [{ pointer: "keys", size: "laptop" }],
  },
  {
    anchors: [],
    id: "mock.chooser",
    prerequisites: { persona: { name: "ana" } },
    proof: "Half of day 1",
    reach: [],
    screen: "/mock/new",
    sizes: PHONE_AND_LAPTOP,
  },
  // A sheet keeps its frame when a tap inside it shows more (case 11's shape).
  {
    anchors: [SHEET_FRAME],
    id: "plan.adjust",
    prerequisites: { persona: { flags: ["--free"], name: "pedro" } },
    proof: "Adjust your plan",
    reach: [{ click: "Adjust plan" }, { wait: "Adjust your plan" }],
    screen: "/plan",
    sizes: [{ pointer: "touch", size: "phone" }],
  },
  {
    anchors: [SHEET_FRAME],
    id: "plan.adjust.weekends",
    pair: { change: [], with: "plan.adjust" },
    prerequisites: { persona: { flags: ["--free"], name: "pedro" } },
    proof: "Weekends",
    reach: [
      { click: "Adjust plan" },
      { wait: "Adjust your plan" },
      { click: "Different time on weekends" },
    ],
    screen: "/plan",
    sizes: [{ pointer: "touch", size: "phone" }],
  },
  // A limit's action takes the main action's place on the call sheet and course start (cases 9
  // and 11, 00340a206a): reached only from a learner at a limit.
  {
    anchors: [SHEET_FRAME, PINNED_ACTION],
    id: "practice.call-sheet.limit",
    pair: { change: [], with: "practice.call-sheet" },
    prerequisites: {
      persona: { flags: ["--free"], name: "pedro" },
      seed: "the free call time used up",
    },
    proof: "Subscribe",
    reach: null,
    screen: "/today",
    sizes: PHONE_AND_LAPTOP,
  },
  {
    anchors: [SHEET_FRAME, PINNED_ACTION],
    id: "practice.call-sheet",
    prerequisites: {
      persona: { flags: ["--free"], name: "pedro" },
      seed: "a language goal with a call to practice",
    },
    proof: "Start",
    reach: null,
    screen: "/today",
    sizes: PHONE_AND_LAPTOP,
  },
  // A notice under a pinned action (case 9), and a failed lesson's two actions (case 12): reached
  // only from a seeded state, which these list so a run can't skip them unnoticed.
  {
    anchors: [PINNED_ACTION],
    id: "today.limit-notice",
    pair: { change: ["notice"], with: "today.start" },
    prerequisites: { persona: { name: "maya" }, seed: "the learner's daily lessons used up" },
    proof: "You've used",
    reach: null,
    screen: "/today",
    sizes: PHONE_AND_LAPTOP,
  },
  {
    anchors: [PINNED_ACTION],
    id: "today.start",
    prerequisites: { persona: { name: "maya" } },
    proof: "Today",
    reach: [],
    screen: "/today",
    sizes: PHONE_AND_LAPTOP,
  },
  {
    anchors: [PINNED_ACTION],
    id: "session.lesson-wait.failed",
    prerequisites: { persona: { name: "maya" }, seed: "the next lesson's writing failed" },
    proof: "Try again",
    reach: null,
    screen: "/today",
    sizes: PHONE_AND_LAPTOP,
  },
  {
    anchors: [],
    id: "today.insight",
    prerequisites: {
      persona: { name: "maya" },
      seed: "a plan-change insight the learner hasn't answered",
    },
    proof: "Move it",
    reach: null,
    screen: "/today",
    sizes: [{ pointer: "keys", size: "laptop" }],
  },
  {
    anchors: [],
    id: "mind-maps.offer.stopped",
    pair: { change: ["notice"], with: "mind-maps.offer.lifted" },
    prerequisites: { persona: { name: "maya" }, seed: "the day's map count used up" },
    proof: "Subscribe",
    reach: null,
    screen: "/mind-maps",
    sizes: PHONE_AND_LAPTOP,
  },
  {
    anchors: [],
    id: "mind-maps.offer.lifted",
    prerequisites: { persona: { name: "maya" } },
    proof: "Other chapters",
    reach: [],
    screen: "/mind-maps",
    sizes: PHONE_AND_LAPTOP,
  },
];
