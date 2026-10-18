import { describe, expect, it } from "vitest";
import { type GoalSkillGraph } from "../../library/curriculum/save-goal-skills";
import { type PlanGraph } from "../../plans/planner/plan-state";
import { pickPlacementGraphSkillIds, pickPlacementItemSkillIds } from "./placement-item-picks";

/** Each picked skill's place in its subject, from its fixture id ("Subject 3/2" is 2). */
function positionsOf(ids: readonly string[]): number[] {
  return ids.map((id) => Number(id.split("/")[1]));
}

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

/** A graph whose skills build on nothing: no subject has basics. */
const NO_EDGES = new Map<string, string[]>();

describe(pickPlacementItemSkillIds, () => {
  it("picks both ends and the middle of each phase, in plan order", () => {
    const graph = graphOf([
      ...Array.from({ length: 7 }, (_, index) => ({ area: null, id: `a${index}`, phase: 0 })),
      { area: null, id: "b0", phase: 1 },
      { area: null, id: "b1", phase: 1 },
    ]);

    expect(pickPlacementItemSkillIds({ graph, prerequisites: NO_EDGES })).toStrictEqual([
      "a0",
      "a3",
      "a6",
      "b0",
      "b1",
    ]);
  });

  it("picks every skill of a test from the learner's own material, which placement all asks", () => {
    const graph = graphOf([
      ...Array.from({ length: 7 }, (_, index) => ({ area: "Biologia", id: `a${index}`, phase: 0 })),
      { area: "Biologia", id: "b0", phase: 1 },
    ]);

    expect(
      pickPlacementItemSkillIds({ everySkill: true, graph, prerequisites: NO_EDGES }),
    ).toStrictEqual([...Array.from({ length: 7 }, (_, index) => `a${index}`), "b0"]);
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

    const picked = pickPlacementItemSkillIds({ graph, prerequisites: NO_EDGES });

    // Day 1 asks at most 12 questions: 16 skills cover it with room for the walk to choose.
    expect(picked).toHaveLength(16);
    expect(new Set(picked.map((id) => id.split("/")[0])).size).toBe(areas.length);
    expect(picked.every((id) => id.split("/")[1] === "0")).toBe(true);
    // Each subject's pick placement asks first: without a level, its middle, as the walk starts.
    expect(picked).toContain("Subject 12/0/1");
  });

  it("covers every subject of an exam with more subjects than the cap, its weak ones first", () => {
    // The OAB's first phase has 20 subjects; the learner asked to focus on two of them.
    const areas = Array.from({ length: 20 }, (_, index) => `Subject ${index}`);

    const graph = graphOf(
      areas.flatMap((area) =>
        Array.from({ length: 4 }, (_, index) => ({ area, id: `${area}/${index}`, phase: 0 })),
      ),
    );

    const picked = pickPlacementItemSkillIds({ graph, prerequisites: NO_EDGES });
    expect(new Set(picked.map((id) => id.split("/")[0])).size).toBe(areas.length);

    // With fewer subjects than the cap, the weak ones get the picks left after each subject's
    // first: their first skill, where a wrong answer settles where they start.
    const few = graphOf(
      graph.skills
        .slice(0, 13 * 4)
        .map((skill) => ({ area: skill.area, id: skill.skillId, phase: 0 })),
    );

    const weak = pickPlacementItemSkillIds({
      focusAreas: ["Subject 11", "Subject 12"],
      graph: few,
      prerequisites: NO_EDGES,
    });

    expect(weak).toHaveLength(16);
    expect(weak).toContain("Subject 11/0");
    expect(weak).toContain("Subject 12/0");
  });

  // Sofia studied the OAB before: the bands below her level are her word, which placement confirms
  // first, so day 1 needs each subject's first skill's question; without a level, it starts in the
  // middle.
  it("picks each subject's first skill for a learner who gave a level, the middle without one", () => {
    const areas = Array.from({ length: 20 }, (_, index) => `Subject ${index}`);

    const graph = graphOf(
      areas.flatMap((area) =>
        Array.from({ length: 5 }, (_, index) => ({ area, id: `${area}/${index}`, phase: 0 })),
      ),
    );

    const picked = (ownLevel?: "advanced" | "intermediate") =>
      new Set(positionsOf(pickPlacementItemSkillIds({ graph, ownLevel, prerequisites: NO_EDGES })));

    expect(picked("intermediate")).toStrictEqual(new Set([0]));
    expect(picked("advanced")).toStrictEqual(new Set([0]));
    expect(picked()).toStrictEqual(new Set([2]));
  });

  it("picks the basics of the subjects the learner knows well first, which placement confirms first", () => {
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

    // What builds on each basic: a phase-1 skill on its phase-0 one.
    const prerequisites = new Map(
      graph.skills
        .filter((skill) => skill.phase === 1)
        .map((skill) => [skill.skillId, [skill.skillId.replace("/1/", "/0/")]]),
    );

    const picked = pickPlacementItemSkillIds({
      graph,
      knownAreas: ["Languages", "Math"],
      prerequisites,
    });

    const pickedIn = (area: string, phase: number) =>
      picked.filter((id) => id.startsWith(`${area}/${phase}/`)).length;

    // Every basic of a subject they know well: that's their word, which only answers confirm.
    expect([pickedIn("Languages", 0), pickedIn("Math", 0)]).toStrictEqual([3, 3]);
    expect(pickedIn("Languages", 1)).toBeGreaterThan(0);
    expect(pickedIn("Math", 1)).toBeGreaterThan(0);
    expect(pickedIn("Sciences", 0)).toBeGreaterThan(0);
  });

  it("picks no skill the exam practices only with recordings, and gives the cap to the rest", () => {
    const areas = ["Listening", ...Array.from({ length: 7 }, (_, index) => `Subject ${index}`)];

    const graph = graphOf(
      areas.flatMap((area) =>
        Array.from({ length: 4 }, (_, index) => ({ area, id: `${area}/${index}`, phase: 0 })),
      ),
    );

    const listeningSkillIds = new Set(
      graph.skills.filter((skill) => skill.area === "Listening").map((skill) => skill.skillId),
    );

    const picked = pickPlacementItemSkillIds({ graph, listeningSkillIds, prerequisites: NO_EDGES });

    expect(picked.filter((id) => listeningSkillIds.has(id))).toStrictEqual([]);
    expect(picked).toHaveLength(16);
  });

  it("has nothing to pick before the skill graph exists", () => {
    expect(
      pickPlacementItemSkillIds({ graph: { phases: [], skills: [] }, prerequisites: NO_EDGES }),
    ).toStrictEqual([]);
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
      pickPlacementItemSkillIds({ graph: planGraph, prerequisites: NO_EDGES }),
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
      pickPlacementItemSkillIds({ graph: planGraph, prerequisites: NO_EDGES }),
    );
  });
});
