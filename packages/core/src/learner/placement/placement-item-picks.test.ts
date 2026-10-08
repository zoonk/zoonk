import { describe, expect, it } from "vitest";
import { type GoalSkillGraph } from "../../library/curriculum/save-goal-skills";
import { type PlanGraph } from "../../plans/planner/plan-state";
import { pickPlacementGraphSkillIds, pickPlacementItemSkillIds } from "./placement-item-picks";

function graphOf(skills: { area: string | null; id: string; phase: number }[]): PlanGraph {
  return {
    phases: [],
    skills: skills.map((skill) => ({
      area: skill.area,
      lessons: 1,
      name: skill.id,
      phase: skill.phase,
      skillId: skill.id,
      weight: null,
    })),
  };
}

describe(pickPlacementItemSkillIds, () => {
  it("picks both ends and the middle of each phase, in plan order", () => {
    const graph = graphOf([
      ...Array.from({ length: 7 }, (_, index) => ({ area: null, id: `a${index}`, phase: 0 })),
      { area: null, id: "b0", phase: 1 },
      { area: null, id: "b1", phase: 1 },
    ]);

    expect(pickPlacementItemSkillIds({ graph })).toStrictEqual(["a0", "a3", "a6", "b0", "b1"]);
  });

  it("picks every skill of a test from the learner's own material, which placement all asks", () => {
    const graph = graphOf([
      ...Array.from({ length: 7 }, (_, index) => ({ area: "Biologia", id: `a${index}`, phase: 0 })),
      { area: "Biologia", id: "b0", phase: 1 },
    ]);

    expect(pickPlacementItemSkillIds({ everySkill: true, graph })).toStrictEqual([
      ...Array.from({ length: 7 }, (_, index) => `a${index}`),
      "b0",
    ]);
  });

  it("covers every area of a big exam before a later phase of any, up to 16 skills", () => {
    const areas = Array.from({ length: 13 }, (_, index) => `Subject ${index}`);

    const graph = graphOf(
      [0, 1].flatMap((phase) =>
        areas.flatMap((area) =>
          Array.from({ length: 4 }, (_, index) => ({
            area,
            id: `${area}/${phase}/${index}`,
            phase,
          })),
        ),
      ),
    );

    const picked = pickPlacementItemSkillIds({ graph });

    // Day 1 asks at most 12 questions: 16 skills cover it with room for the walk to choose.
    expect(picked).toHaveLength(16);
    expect(new Set(picked.map((id) => id.split("/")[0])).size).toBe(areas.length);
    expect(picked.every((id) => id.split("/")[1] === "0")).toBe(true);
    expect(picked).toContain("Subject 12/0/0");
  });

  it("skips the basics of the subjects the learner knows well, which placement takes as known", () => {
    // ENEM's four objective areas, each its basics in phase 0 and what builds on them in phase 1;
    // the learner said they know Languages and Math well.
    const areas = ["Languages", "Math", "Sciences", "Humanities"];

    const graph = graphOf(
      [0, 1].flatMap((phase) =>
        areas.flatMap((area) =>
          Array.from({ length: 3 }, (_, index) => ({
            area,
            id: `${area}/${phase}/${index}`,
            phase,
          })),
        ),
      ),
    );

    const picked = pickPlacementItemSkillIds({ graph, knownAreas: ["Languages", "Math"] });

    const pickedIn = (area: string, phase: number) =>
      picked.filter((id) => id.startsWith(`${area}/${phase}/`)).length;

    expect([pickedIn("Languages", 0), pickedIn("Math", 0)]).toStrictEqual([0, 0]);
    expect(pickedIn("Languages", 1)).toBeGreaterThan(0);
    expect(pickedIn("Math", 1)).toBeGreaterThan(0);
    expect(pickedIn("Sciences", 0)).toBeGreaterThan(0);
  });

  it("has nothing to pick before the skill graph exists", () => {
    expect(pickPlacementItemSkillIds({ graph: { phases: [], skills: [] } })).toStrictEqual([]);
  });
});

/** A skill graph as the model writes it: phases counted from 1, courses as the areas. */
function skillGraphOf(skills: { course: string; key: string; phase: number }[]): GoalSkillGraph {
  const courses = [...new Set(skills.map((skill) => skill.course))];

  return {
    courses: courses.map((key) => ({ key, levels: ["beginner"], title: `Course ${key}` })),
    estimatedHours: 10,
    phases: [1, 2].map((phase) => ({
      estimatedHours: 5,
      milestone: `Milestone ${phase}`,
      title: `Phase ${phase}`,
    })),
    skills: skills.map((skill) => ({
      ...skill,
      area: `Course ${skill.course}`,
      description: skill.key,
      estimatedLessons: 1,
      examWeight: null,
      level: "beginner",
      name: skill.key,
      prerequisites: [],
      topics: [],
    })),
  };
}

describe(pickPlacementGraphSkillIds, () => {
  it("picks from the skill graph what the plan will pick, before the plan is saved", () => {
    const graph = skillGraphOf([
      ...Array.from({ length: 7 }, (_, index) => ({ course: "math", key: `m${index}`, phase: 1 })),
      { course: "history", key: "h0", phase: 1 },
      { course: "math", key: "m7", phase: 2 },
    ]);

    const idsByKey = Object.fromEntries(
      graph.skills.map((skill) => [skill.key, `id-${skill.key}`]),
    );

    const planGraph = graphOf(
      graph.skills.map((skill) => ({
        area: `Course ${skill.course}`,
        id: `id-${skill.key}`,
        phase: skill.phase - 1,
      })),
    );

    expect(pickPlacementGraphSkillIds({ everySkill: false, graph, idsByKey })).toStrictEqual(
      pickPlacementItemSkillIds({ graph: planGraph }),
    );

    expect(pickPlacementGraphSkillIds({ everySkill: false, graph, idsByKey })).toStrictEqual(
      ["m0", "m3", "m6", "h0", "m7"].map((key) => `id-${key}`),
    );
  });

  it("picks what the plan picks when the Library found one skill for two of the graph's", () => {
    const graph = skillGraphOf(
      Array.from({ length: 7 }, (_, index) => ({ course: "math", key: `m${index}`, phase: 1 })),
    );

    // The graph's first two skills are the same Library skill: the plan keeps it once.
    const idsByKey = {
      ...Object.fromEntries(graph.skills.map((skill) => [skill.key, `id-${skill.key}`])),
      m1: "id-m0",
    };

    const planGraph = graphOf(
      ["m0", "m2", "m3", "m4", "m5", "m6"].map((key) => ({
        area: "Course math",
        id: `id-${key}`,
        phase: 0,
      })),
    );

    expect(pickPlacementGraphSkillIds({ everySkill: false, graph, idsByKey })).toStrictEqual(
      pickPlacementItemSkillIds({ graph: planGraph }),
    );
  });
});
