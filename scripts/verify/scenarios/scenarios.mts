import { type Anchor, PHONE_AND_LAPTOP, type Scenario } from "./shape.mts";
import { STATE_SCENARIOS } from "./states.mts";

export type { Prerequisites, Scenario, Step } from "./shape.mts";

/**
 * The named states a screen can be in, shared by the web, Android and Apple (`REPORT-SHAPE.md`).
 * A capture says which scenario it shows; the evaluator fails a scenario a run was asked for and
 * didn't capture, one it doesn't know, and an anchor that moved between the two scenarios of a
 * pair. Whoever adds a branch to a screen (a gate, a limit, a notice, a wait) adds its scenario
 * here; a screen's lane fills in the rest of its own.
 */
/** A laptop at twice the default text: large-text learners on the web, otherwise unmeasured. */
const LAPTOP_TEXT_2X: Scenario["sizes"][number] = { pointer: "keys", size: "laptop", textScale: 2 };

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
      LAPTOP_TEXT_2X,
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
  // The catalog at a phone's text x2: its subject glyphs and chips, for a large-text learner.
  {
    anchors: [],
    id: "catalog.visitor.large-text",
    prerequisites: { persona: "visitor" },
    proof: "Log in",
    reach: [],
    screen: "/courses",
    sizes: [{ pointer: "touch", size: "phone", textScale: 2 }],
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
  // from a state written on the copy, or listed by what it needs so a run can't skip it unnoticed.
  {
    anchors: [PINNED_ACTION],
    from: "/today",
    id: "lesson.limit-notice",
    prerequisites: { persona: { flags: ["--free"], name: "maya" }, state: "lessons-used-up" },
    proof: "You've used your free lessons",
    reach: [{ click: "Continue" }],
    screen: "/learn/[lesson]",
    sizes: PHONE_AND_LAPTOP,
  },
  {
    anchors: [PINNED_ACTION],
    id: "today.start",
    prerequisites: { persona: { name: "maya" } },
    proof: "Today",
    reach: [],
    screen: "/today",
    sizes: [...PHONE_AND_LAPTOP, LAPTOP_TEXT_2X],
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
    prerequisites: { persona: { flags: ["--free"], name: "maya" }, state: "maps-used-up" },
    proof: "Subscribe",
    reach: [],
    screen: "/mind-maps",
    sizes: PHONE_AND_LAPTOP,
  },
  ...STATE_SCENARIOS,
  {
    anchors: [],
    id: "mind-maps.offer.lifted",
    prerequisites: { persona: { name: "maya" } },
    proof: "Other chapters",
    reach: [],
    screen: "/mind-maps",
    sizes: [...PHONE_AND_LAPTOP, LAPTOP_TEXT_2X],
  },
];
