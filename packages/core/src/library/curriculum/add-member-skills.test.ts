import { describe, expect, it } from "vitest";
import { addMemberSkills } from "./add-member-skills";
import { type GoalSkillGraph } from "./save-goal-skills";

type GraphSkill = GoalSkillGraph["skills"][number];

function skill(key: string, attrs: Partial<GraphSkill> = {}): GraphSkill {
  return {
    area: "Memorization",
    course: "recitation",
    description: key,
    estimatedLessons: 3,
    examWeight: null,
    key,
    level: "beginner",
    name: key,
    phase: 1,
    prerequisites: [],
    topics: [],
    ...attrs,
  };
}

const GRAPH: GoalSkillGraph = {
  courses: [],
  estimatedHours: 10,
  phases: [],
  skills: [
    skill("letters"),
    skill("part-5", { phase: 2 }),
    skill("part-4", { estimatedLessons: 6, phase: 3, prerequisites: ["letters"] }),
    skill("part-2", { phase: 3 }),
    skill("part-1", { phase: 4 }),
  ],
};

describe(addMemberSkills, () => {
  it("adds each uncovered member beside its neighbor in teaching order, taking its place", () => {
    const graph = addMemberSkills({
      coverage: {
        members: [
          { name: "One", number: 1, skills: ["part-1"] },
          { name: "Two", number: 2, skills: ["part-2"] },
          { name: "Three", number: 3, skills: [] },
          { name: "Four", number: 4, skills: ["part-4"] },
          { name: "Five", number: 5, skills: ["part-5"] },
        ],
        reason: "Your plan left out part three.",
        set: "Parts",
        uncovered: [
          { description: "Recite part three.", member: "Three", name: "Recite part 3", number: 3 },
        ],
      },
      graph: GRAPH,
    });

    expect(graph.skills.map((item) => item.key)).toStrictEqual([
      "letters",
      "part-5",
      "part-4",
      "member-1",
      "part-2",
      "part-1",
    ]);

    expect(graph.skills[3]).toStrictEqual({
      area: "Memorization",
      course: "recitation",
      description: "Recite part three.",
      estimatedLessons: 6,
      examWeight: null,
      key: "member-1",
      level: "beginner",
      name: "Recite part 3",
      phase: 3,
      prerequisites: ["letters"],
      topics: [],
    });
  });

  it("leaves the graph as it is when no member is uncovered", () => {
    expect(
      addMemberSkills({
        coverage: { members: [], reason: null, set: null, uncovered: [] },
        graph: GRAPH,
      }),
    ).toBe(GRAPH);
  });
});
