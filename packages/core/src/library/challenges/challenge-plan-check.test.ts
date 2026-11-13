import { type ChallengePlan } from "@zoonk/ai/tasks/challenge/plan";
import { describe, expect, it } from "vitest";
import { checkChallengePlan } from "./challenge-plan-check";

type PlanChoice = ChallengePlan["decisions"][number]["choices"][number];

function choice(overrides: Pick<PlanChoice, "id" | "next" | "quality">): PlanChoice {
  return {
    buys: "Time",
    costs: "Certainty",
    establishes: [],
    move: "Act",
    timePasses: null,
    ...overrides,
  };
}

function plan(): ChallengePlan {
  return {
    deadline: "Meeting at 3 pm",
    decisions: [
      {
        choices: [
          { ...choice({ id: "check", next: "report", quality: "strong" }), establishes: ["test"] },
          choice({ id: "skip", next: "report", quality: "weak" }),
        ],
        id: "start",
        insight: "A small gap can be chance",
        pull: "The manager wants an answer now",
        situation: "Version B is ahead",
        skills: ["chance"],
      },
      {
        choices: [
          choice({ id: "plain", next: "sent", quality: "strong" }),
          choice({ id: "short", next: "unclear", quality: "fair" }),
        ],
        id: "report",
        insight: "Say what the result shows",
        pull: "The manager wants one line",
        situation: "The manager asks what to tell the team",
        skills: ["chance"],
      },
    ],
    endings: [
      { id: "sent", restsOn: [], result: "The team waits." },
      { id: "unclear", restsOn: [], result: "The manager launches." },
    ],
    facts: [{ derivation: "given", fact: "The test finds p = 0.21", id: "test", known: "later" }],
    meters: [{ goodWhen: "low", id: "risk", label: "Risk", start: 50 }],
    mission: "Decide whether **version B** is ready.",
    panels: [],
    setting: "Day 3 at Aurora Shop",
    skills: [{ id: "chance", name: "Chance", practice: "Name one gap that could be chance." }],
    startDecisionId: "start",
    team: [{ ai: true, expertise: "Runs checks", id: "ai", role: "AI assistant" }],
    title: "Is version B ready?",
  };
}

describe(checkChallengePlan, () => {
  it("passes a plan whose graph and facts hold, before any prose exists", () => {
    expect(checkChallengePlan({ plan: plan(), skills: ["chance"], variant: "work" })).toStrictEqual(
      [],
    );
  });

  it("finds a broken graph in the plan", () => {
    const broken = plan();

    const problems = checkChallengePlan({
      plan: {
        ...broken,
        decisions: broken.decisions.map((decision) => ({
          ...decision,
          choices: decision.choices.map((item) =>
            item.id === "short" ? { ...item, next: "nowhere" } : item,
          ),
        })),
      },
      skills: ["chance"],
      variant: "work",
    });

    expect(problems.join("\n")).toContain(
      'Choice "short" leads to "nowhere", which doesn\'t exist',
    );

    expect(problems.join("\n")).toContain('"unclear" can\'t be reached from the start');
  });

  it("finds a plan that dropped a skill it was given", () => {
    const given = ["chance", "sample", "explain", "plan", "report"];

    expect(checkChallengePlan({ plan: plan(), skills: given, variant: "work" })).toStrictEqual([
      "The plan trains 1 of the 5 skills it must: `skills` needs one entry for each skill in SKILLS, in the same order, each trained by a decision",
    ]);
  });

  it("finds a skill no decision trains and an ending that cites a skipped check", () => {
    const base = plan();

    const problems = checkChallengePlan({
      plan: {
        ...base,
        endings: base.endings.map((ending) => ({ ...ending, restsOn: ["test"] })),
        skills: [...base.skills, { id: "explain", name: "Explaining", practice: "Explain it." }],
      },
      skills: ["chance", "explain"],
      variant: "work",
    });

    expect(problems.join("\n")).toContain('No decision trains skill "explain"');
    expect(problems.join("\n")).toContain('Ending "sent" rests on "test"');
  });
});
