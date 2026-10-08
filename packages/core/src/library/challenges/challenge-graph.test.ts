import {
  CHALLENGE_STRONG_PATH,
  CHALLENGE_WEAK_PATH,
  challengeCaseFixture,
} from "@zoonk/testing/fixtures/challenge-contents";
import { describe, expect, it } from "vitest";
import { type ChallengeContent } from "../steps/contract/challenge-content";
import { safeParseStepContent } from "../steps/contract/step-contract";
import { getChallengeGraphIssues, walkChallenge } from "./challenge-graph";

type Case = ReturnType<typeof challengeCaseFixture>;

function withNode(content: Case, nodeId: string, change: (node: Case["nodes"][number]) => object) {
  return {
    ...content,
    nodes: content.nodes.map((node) => (node.id === nodeId ? change(node) : node)),
  };
}

function issuesOf(content: unknown): string[] {
  return getChallengeGraphIssues(content as ChallengeContent).map((issue) => issue.message);
}

describe(walkChallenge, () => {
  const content = challengeCaseFixture();

  it("follows the picks to an ending", () => {
    const walk = walkChallenge(content, CHALLENGE_STRONG_PATH);

    expect(walk.status === "ended" && walk.ending.id).toBe("shipped");

    expect(walk.status === "ended" && walk.steps.map((step) => step.node.id)).toStrictEqual([
      "start",
      "report",
      "result",
    ]);
  });

  it("stops at the next decision while the path is still being played", () => {
    expect(walkChallenge(content, []).status).toBe("deciding");

    const walk = walkChallenge(content, ["launch"]);
    expect(walk.status === "deciding" && walk.node.id).toBe("launched");
  });

  it("rejects picks that aren't on their decision or go on past an ending", () => {
    expect(walkChallenge(content, ["ship"]).status).toBe("invalid");
    expect(walkChallenge(content, [...CHALLENGE_WEAK_PATH, "ship"]).status).toBe("invalid");
  });
});

describe(getChallengeGraphIssues, () => {
  it("passes a case whose every path ends after 2 to 4 decisions", () => {
    expect(getChallengeGraphIssues(challengeCaseFixture())).toStrictEqual([]);
    expect(safeParseStepContent("challenge", challengeCaseFixture()).success).toBe(true);
  });

  it("reports ids that point at nothing", () => {
    const content = withNode(challengeCaseFixture(), "start", (node) => ({
      ...node,
      choices: node.choices.map((choice, index) =>
        index === 0
          ? {
              ...choice,
              effects: [{ change: 5, meter: "mood" }],
              next: "nowhere",
              notes: [{ kind: "good", skill: "chess", text: "Nice." }],
              replies: [{ from: "ceo", text: "Hi." }],
            }
          : choice,
      ),
      messages: [{ from: "intern", text: "Hello." }],
    }));

    expect(issuesOf(content)).toStrictEqual(
      expect.arrayContaining([
        'A message is from "intern", who isn\'t on the team',
        'Choice "launch" leads to "nowhere", which doesn\'t exist',
        'A reply is from "ceo", who isn\'t on the team',
        'Choice "launch" moves unknown meter "mood"',
        'A note trains unknown skill "chess"',
      ]),
    );
  });

  it("reports a loop, a path that's too short and a decision nobody reaches", () => {
    const looped = withNode(challengeCaseFixture(), "result", (node) => ({
      ...node,
      choices: node.choices.map((choice) =>
        choice.id === "wait-more" ? { ...choice, next: "start" } : choice,
      ),
    }));

    const short = withNode(challengeCaseFixture(), "start", (node) => ({
      ...node,
      choices: node.choices.map((choice) =>
        choice.id === "launch" ? { ...choice, next: "too-early" } : choice,
      ),
    }));

    expect(issuesOf(looped)).toContain("A path loops back to an earlier decision");

    expect(issuesOf(short)).toStrictEqual(
      expect.arrayContaining([
        "Every path must end after 2 to 4 decisions",
        '"launched" can\'t be reached from the start',
      ]),
    );
  });

  it("reports a decision where every choice is strong, or none is", () => {
    const allStrong = withNode(challengeCaseFixture(), "result", (node) => ({
      ...node,
      choices: node.choices.map((choice) => ({ ...choice, quality: "strong" })),
    }));

    const noneStrong = withNode(challengeCaseFixture(), "result", (node) => ({
      ...node,
      choices: node.choices.map((choice) => ({ ...choice, quality: "fair" })),
    }));

    const message = 'Decision "result" needs a strong choice and at least one that isn\'t';

    expect(issuesOf(allStrong)).toContain(message);
    expect(issuesOf(noneStrong)).toContain(message);
  });

  it("reports two AI colleagues, unknown names, skills nobody trains and a bad start", () => {
    const base = challengeCaseFixture();

    const content = {
      ...base,
      mission: "Help {{boss}} decide.",
      skills: [...base.skills, { id: "ethics", name: "Ethics", practice: "Think about it." }],
      startNodeId: "shipped",
      team: base.team.map((slot) => ({ ...slot, ai: true })),
    };

    expect(issuesOf(content)).toStrictEqual(
      expect.arrayContaining([
        "The case must start with a decision",
        "At most one colleague is an AI assistant",
        '"{{boss}}" names someone who isn\'t on the team',
        'No decision trains skill "ethics"',
      ]),
    );
  });

  it("keeps a case with graph problems out of the step contract", () => {
    const content = { ...challengeCaseFixture(), startNodeId: "missing" };
    const parsed = safeParseStepContent("challenge", content);

    expect(parsed.success).toBe(false);

    expect(parsed.error?.issues.map((issue) => issue.message)).toContain(
      "The case must start with a decision",
    );
  });
});
