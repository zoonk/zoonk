import { describe, expect, it, vi } from "vitest";
import { normalizeMemberCoverage } from "./member-coverage";

vi.mock("server-only", () => ({}));
vi.mock("./member-coverage.prompt.md", () => ({ default: "" }));

const SKILLS = [
  { key: "alpha", name: "Write alpha" },
  { key: "beta-gamma", name: "Write beta and gamma" },
  { key: "review", name: "Review the alphabet" },
];

type Output = Parameters<typeof normalizeMemberCoverage>[0]["output"];

function normalize(output: Partial<Output>) {
  return normalizeMemberCoverage({
    output: { members: [], missing: [], reason: "", set: "Greek alphabet", ...output },
    skills: SKILLS,
  });
}

describe(normalizeMemberCoverage, () => {
  it("returns no members for a goal that names no list", () => {
    expect(
      normalize({
        members: [{ name: "Alpha", number: 1, skills: [] }],
        reason: "Left out alpha.",
        set: null,
      }),
    ).toStrictEqual({ members: [], reason: null, set: null, uncovered: [] });
  });

  it("keeps only the graph's keys, once each, and counts a member left with none as uncovered", () => {
    const { members, uncovered } = normalize({
      members: [
        { name: "Alpha", number: 1, skills: ["alpha", "alpha"] },
        { name: "Beta", number: 2, skills: ["beta-gamma", "made-up"] },
        { name: "Delta", number: 4, skills: ["made-up"] },
      ],
    });

    expect(members).toStrictEqual([
      { name: "Alpha", number: 1, skills: ["alpha"] },
      { name: "Beta", number: 2, skills: ["beta-gamma"] },
      { name: "Delta", number: 4, skills: [] },
    ]);

    expect(uncovered.map((member) => member.number)).toStrictEqual([4]);
  });

  it("keeps the first row of a member written twice", () => {
    const { members } = normalize({
      members: [
        { name: "Alpha", number: 1, skills: ["alpha"] },
        { name: "Alpha again", number: 1, skills: [] },
      ],
    });

    expect(members).toStrictEqual([{ name: "Alpha", number: 1, skills: ["alpha"] }]);
  });

  it("names an uncovered member's skill from its missing entry, or from the member itself", () => {
    const { reason, uncovered } = normalize({
      members: [
        { name: "Delta", number: 4, skills: [] },
        { name: "**Epsilon**", number: 5, skills: [] },
      ],
      missing: [{ description: "Write delta from memory.", name: "Write **delta**", number: 4 }],
      reason: "Your plan left out delta and epsilon.",
    });

    expect(uncovered).toStrictEqual([
      { description: "Write delta from memory.", member: "Delta", name: "Write delta", number: 4 },
      { description: "Epsilon", member: "Epsilon", name: "Epsilon", number: 5 },
    ]);

    expect(reason).toBe("Your plan left out delta and epsilon.");
  });

  it("ignores a missing entry for a member a skill teaches", () => {
    const { reason, uncovered } = normalize({
      members: [{ name: "Alpha", number: 1, skills: ["alpha"] }],
      missing: [{ description: "Write alpha.", name: "Write alpha again", number: 1 }],
      reason: "Your plan left out alpha.",
    });

    expect(uncovered).toStrictEqual([]);
    expect(reason).toBeNull();
  });

  it("drops an uncovered member whose skill the graph already has under its own key", () => {
    const { uncovered } = normalize({
      members: [{ name: "Alpha", number: 1, skills: [] }],
      missing: [{ description: "Write alpha.", name: "Write Alpha", number: 1 }],
    });

    expect(uncovered).toStrictEqual([]);
  });
});
