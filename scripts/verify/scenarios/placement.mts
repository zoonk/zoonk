import { PHONE_AND_LAPTOP, PINNED_ACTION, type Prerequisites, type Scenario } from "./shape.mts";

const PEDRO: Prerequisites["persona"] = { flags: ["--locale", "en"], name: "pedro" };
const ANA: Prerequisites["persona"] = { flags: ["--locale", "en"], name: "ana" };

/** What proves the question's format, beside its words. */
const SELECT_ALL = "[data-slot=answer-option-group][role=group]";
const SELECT_ONE = "[data-slot=answer-option-group][role=radiogroup]";
const MATCH = "[data-slot=match-board]";

/** A test's question, written by the seed, in the page that asks it; each start saves a sitting. */
function question(scenario: Omit<Scenario, "anchors" | "sizes" | "writes">): Scenario {
  return { ...scenario, anchors: [PINNED_ACTION], sizes: PHONE_AND_LAPTOP, writes: true };
}

/** A test's offer or what a sitting ends on: nothing is saved until the learner presses its action. */
function screen(scenario: Omit<Scenario, "anchors" | "sizes">): Scenario {
  return { ...scenario, anchors: [PINNED_ACTION], sizes: PHONE_AND_LAPTOP };
}

/**
 * Each placement test at its offer and at a question, one per format, from the seed's questions
 * with no model call: the order the seed's answers and item ids give is the same on every run.
 */
export const PLACEMENT_SCENARIOS: Scenario[] = [
  screen({
    id: "placement.offer",
    prerequisites: { persona: PEDRO, state: "placement" },
    proof: "Where would you like to start?",
    reach: [{ click: "Continue" }],
    screen: "/today",
  }),
  screen({
    id: "placement-test.offer",
    prerequisites: { persona: PEDRO },
    proof: "Skip what you already know",
    reach: [],
    screen: "/placement-test",
  }),
  question({
    evidence: [SELECT_ONE],
    id: "placement.level-check.choice",
    prerequisites: { persona: PEDRO, state: "placement" },
    proof: "I don't know yet",
    reach: [{ click: "Continue" }, { click: "Start" }],
    screen: "/today",
  }),
  question({
    evidence: [MATCH],
    id: "placement.level-check.match",
    prerequisites: { persona: PEDRO, state: "placement" },
    proof: "I don't know yet",
    reach: [{ click: "Continue" }, { click: "Start" }, { click: "$20.12" }, { click: "Confirm" }],
    screen: "/today",
  }),
  question({
    evidence: [SELECT_ONE],
    id: "placement-test.question",
    prerequisites: { persona: PEDRO },
    proof: "I don't know yet",
    reach: [{ click: "Start" }],
    screen: "/placement-test",
  }),
  question({
    evidence: [SELECT_ALL],
    id: "focus-test.select-all",
    prerequisites: { persona: ANA },
    proof: "I don't know yet",
    reach: [{ click: "Answer more questions" }],
    screen: "/focus-test",
  }),
  question({
    evidence: [MATCH],
    id: "focus-test.match",
    prerequisites: { persona: ANA },
    proof: "I don't know yet",
    reach: [
      { click: "Answer more questions" },
      { click: "The library is looking for volunteers" },
      { click: "The help is needed on Saturdays" },
      { click: "There's a deadline to sign up" },
      { click: "Confirm" },
    ],
    screen: "/focus-test",
  }),
  {
    ...question({
      evidence: [SELECT_ONE],
      id: "level-test.question",
      prerequisites: { persona: { name: "marcos" } },
      proof: "I don't know yet",
      reach: [{ click: "Começar" }],
      screen: "/level-test",
    }),
    // Marcos's English course is only for Portuguese speakers.
    sizes: PHONE_AND_LAPTOP.map((size) => ({ ...size, locale: "pt" })),
  },
];
