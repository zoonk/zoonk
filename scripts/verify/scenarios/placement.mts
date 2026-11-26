import { PHONE_AND_LAPTOP, PINNED_ACTION, type Prerequisites, type Scenario } from "./shape.mts";

const PEDRO: Prerequisites["persona"] = { flags: ["--locale", "en"], name: "pedro" };
const ANA: Prerequisites["persona"] = { flags: ["--locale", "en"], name: "ana" };

/** What proves the question's format, beside its words. */
const SELECT_ALL = "[data-slot=answer-option-group][role=group]";
const SELECT_ONE = "[data-slot=answer-option-group][role=radiogroup]";
const MATCH = "[data-slot=match-board]";
const ORDER = "[data-slot=activity-sortable-list]";

/** A test's question, written by the seed, in the page that asks it; each start saves a sitting. */
function question(scenario: Omit<Scenario, "anchors" | "sizes" | "writes">): Scenario {
  return { ...scenario, anchors: [PINNED_ACTION], sizes: PHONE_AND_LAPTOP, writes: true };
}

/**
 * Each placement test at a question, one per format, from the seed's questions with no model call:
 * the order the seed's answers and item ids give is the same on every run.
 */
export const PLACEMENT_SCENARIOS: Scenario[] = [
  question({
    evidence: [SELECT_ALL],
    id: "placement.level-check.select-all",
    prerequisites: { persona: PEDRO, state: "placement" },
    proof: "Question 1",
    reach: [{ click: "Continue" }, { click: "Start" }],
    screen: "/today",
  }),
  question({
    evidence: [ORDER],
    id: "placement.level-check.order",
    prerequisites: { persona: PEDRO, state: "placement" },
    proof: "Drag the steps into order.",
    reach: [
      { click: "Continue" },
      { click: "Start" },
      { click: "You own a small piece of the company" },
      { click: "Your piece is worth more if the company grows" },
      { click: "You own part of its future profits" },
      { click: "Confirm" },
    ],
    screen: "/today",
  }),
  question({
    evidence: [SELECT_ONE],
    id: "placement-test.question",
    prerequisites: { persona: PEDRO },
    proof: "Part 1",
    reach: [{ click: "Whole course" }, { click: "Start" }],
    screen: "/placement-test",
  }),
  question({
    evidence: [SELECT_ALL],
    id: "focus-test.select-all",
    prerequisites: { persona: ANA },
    proof: "Question 1 of 10",
    reach: [{ click: "Answer more questions" }],
    screen: "/focus-test",
  }),
  question({
    evidence: [MATCH],
    id: "focus-test.match",
    prerequisites: { persona: ANA },
    proof: "Question 2 of 10",
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
