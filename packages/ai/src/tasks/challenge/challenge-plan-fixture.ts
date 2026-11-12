import { type ChallengePlan } from "./challenge-plan";

export function challengePlanFixture(): ChallengePlan {
  return {
    deadline: "Meeting at 3 pm",
    decisions: [
      {
        choices: [
          {
            buys: "Knowing whether the gap holds",
            costs: "An hour of the afternoon",
            establishes: ["test"],
            id: "check",
            move: "Ask the AI to test the gap",
            next: "report",
            quality: "strong",
            timePasses: "One hour later",
          },
          {
            buys: "An answer before the meeting",
            costs: "Nobody knows whether the gap holds",
            establishes: [],
            id: "skip",
            move: "Take the gap as it is",
            next: "report",
            quality: "weak",
            timePasses: null,
          },
        ],
        id: "start",
        insight: "A small gap on few visits can be chance",
        pull: "The manager wants an answer now",
        situation: "Version B is ahead after one day",
        skills: ["chance"],
      },
      {
        choices: [
          {
            buys: "A clear message",
            costs: "Nothing left to check",
            establishes: [],
            id: "plain",
            move: "Say what the numbers support",
            next: "sent",
            quality: "strong",
            timePasses: null,
          },
          {
            buys: "A shorter message",
            costs: "The manager reads more into it",
            establishes: [],
            id: "short",
            move: "Send the two rates",
            next: "unclear",
            quality: "fair",
            timePasses: null,
          },
        ],
        id: "report",
        insight: "Say what the result does and doesn't show",
        pull: "The manager wants one line",
        situation: "The manager asks what to tell the team",
        skills: ["explain"],
      },
    ],
    endings: [
      { id: "sent", restsOn: ["visits"], result: "The team waits for more visits." },
      { id: "unclear", restsOn: [], result: "The manager launches on a hunch." },
    ],
    facts: [
      { derivation: "given", fact: "1,200 visits per version", id: "visits", known: "start" },
      { derivation: "given", fact: "The test finds p = 0.21", id: "test", known: "later" },
    ],
    meters: [{ goodWhen: "low", id: "risk", label: "Risk of a wrong call", start: 50 }],
    mission: "Decide whether **version B** is ready.",
    panels: [
      { metrics: [{ label: "Visits", note: null, value: "1,200" }], note: null, title: null },
    ],
    setting: "Day 3 at Aurora Shop",
    skills: [
      { id: "chance", name: "Chance", practice: "Name one gap that could be chance." },
      { id: "explain", name: "Explaining", practice: "Explain one result in a sentence." },
    ],
    startDecisionId: "start",
    team: [
      { ai: false, expertise: "Wants to launch", id: "product", role: "Product manager" },
      { ai: true, expertise: "Runs checks", id: "ai", role: "AI assistant" },
    ],
    title: "Is version B ready?",
  };
}
