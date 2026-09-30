import { describe, expect, it } from "vitest";
import { toGoalPlanGraph } from "./goal-plan-graph";
import { type GoalSkillGraph } from "./save-goal-skills";

function graphSkill(overrides: Partial<GoalSkillGraph["skills"][number]> & { key: string }) {
  return {
    course: "math",
    description: `Idea of ${overrides.key}`,
    estimatedLessons: 3,
    examWeight: null,
    level: "beginner" as const,
    name: `Skill ${overrides.key}`,
    phase: 1,
    prerequisites: [],
    ...overrides,
  };
}

const graph: GoalSkillGraph = {
  courses: [
    { key: "math", levels: ["beginner"], title: "Math foundations" },
    { key: "physics", levels: ["beginner"], title: "Classical mechanics" },
  ],
  estimatedHours: 10,
  phases: [
    { estimatedHours: 4, milestone: "Solve equations", title: "Foundations" },
    { estimatedHours: 6, milestone: "Predict motion", title: "Mechanics" },
  ],
  skills: [
    graphSkill({ key: "algebra" }),
    graphSkill({ examWeight: 4, key: "vectors", phase: 1 }),
    graphSkill({ course: "physics", key: "forces", phase: 2, prerequisites: ["vectors"] }),
    graphSkill({ course: "physics", key: "unsaved", phase: 2 }),
  ],
};

describe(toGoalPlanGraph, () => {
  it("keeps teaching order, counts phases from zero and uses the course as the area", () => {
    const result = toGoalPlanGraph({
      courseIdsByKey: { math: "course-math", physics: "course-physics" },
      graph,
      idsByKey: { algebra: "skill-a", forces: "skill-f", vectors: "skill-v" },
    });

    expect(result).toStrictEqual({
      phases: [
        { milestone: "Solve equations", name: "Foundations" },
        { milestone: "Predict motion", name: "Mechanics" },
      ],
      skills: [
        {
          area: "Math foundations",
          courseIds: ["course-math"],
          lessons: 3,
          name: "Skill algebra",
          phase: 0,
          skillId: "skill-a",
          weight: null,
        },
        {
          area: "Math foundations",
          courseIds: ["course-math"],
          lessons: 3,
          name: "Skill vectors",
          phase: 0,
          skillId: "skill-v",
          weight: 4,
        },
        {
          area: "Classical mechanics",
          courseIds: ["course-physics"],
          lessons: 3,
          name: "Skill forces",
          phase: 1,
          skillId: "skill-f",
          weight: null,
        },
      ],
    });
  });

  it("keeps one entry, at the first place, for graph skills the Library resolved to the same skill", () => {
    const result = toGoalPlanGraph({
      courseIdsByKey: { math: "course-math", physics: "course-physics" },
      graph,
      idsByKey: { algebra: "shared", forces: "shared", unsaved: "other", vectors: "skill-v" },
    });

    expect(result.skills.map((skill) => skill.skillId)).toStrictEqual([
      "shared",
      "skill-v",
      "other",
    ]);

    // The goal needs the merged skill in both subjects, so both courses' lessons can teach it.
    expect(result.skills[0]).toMatchObject({
      courseIds: ["course-math", "course-physics"],
      name: "Skill algebra",
      phase: 0,
    });
  });
});
