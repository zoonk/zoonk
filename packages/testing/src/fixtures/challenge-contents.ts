import {
  launchedDecision,
  reportDecision,
  resultDecision,
  startDecision,
} from "./_utils/challenge-decisions";

/**
 * A work case in the challenge step contract: judging an A/B test before a meeting, with a data
 * scientist, a product manager and an AI assistant. Every path ends after 2 or 3 decisions. The
 * strong path is `ask-ai` → `explain-plain` → `ship`.
 */
export function challengeCaseFixture() {
  return {
    deadline: "Meeting with {{product}} today at 3 pm",
    endings: [
      {
        id: "shipped",
        outcome: "Version B went to everyone: 3.1% → 3.7%, or 19% more purchases per visit.",
      },
      {
        id: "too-early",
        outcome:
          "B went out after one day. A month later, sales look just like before: the early gap was chance.",
      },
      {
        id: "too-late",
        outcome: "B went to everyone a week later than it could have. The gain was real all along.",
      },
    ],
    meters: [
      { goodWhen: "low" as const, id: "risk", label: "Risk of a wrong call", start: 70 },
      { goodWhen: "high" as const, id: "patience", label: "{{product}}'s patience", start: 80 },
    ],
    mission: "Decide whether **version B** of the buy button should go to everyone.",
    nodes: [startDecision(), launchedDecision(), reportDecision(), resultDecision()],
    panels: [
      {
        metrics: [
          { label: "Version A · current", value: "3.1%" },
          { label: "Version B · new", value: "3.4%" },
        ],
        note: "Conversion · 1,200 visits per version · live for 1 day",
      },
    ],
    setting: "Day 3 at Aurora Shop",
    skills: [
      {
        id: "sample",
        name: "Sample size",
        practice: "Before deciding, ask how many people each number comes from.",
      },
      {
        id: "significance",
        name: "Significance",
        practice: "Ask whether a gap this size could show up by chance, and check before you act.",
      },
      {
        id: "explaining",
        name: "Explaining data",
        practice: "Explain a test result to someone who isn't a data person, in one sentence.",
      },
    ],
    startNodeId: "start",
    team: [
      {
        ai: false,
        expertise: "Knows testing and how much data a decision needs",
        id: "data",
        role: "Data scientist",
      },
      {
        ai: false,
        expertise: "Knows the customers and wants to ship fast",
        id: "product",
        role: "Product manager",
      },
      { ai: true, expertise: "Runs the numbers when asked", id: "ai", role: "AI assistant" },
    ],
    title: "Does button B sell more?",
    variant: "work" as const,
  };
}

/** The strong path through `challengeCaseFixture`, one choice per decision. */
export const CHALLENGE_STRONG_PATH = ["ask-ai", "explain-plain", "ship"];

/** A weak path through `challengeCaseFixture` that ends early. */
export const CHALLENGE_WEAK_PATH = ["launch", "keep-live"];
