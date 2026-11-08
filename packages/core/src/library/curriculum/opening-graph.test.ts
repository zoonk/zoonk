import { describe, expect, it } from "vitest";
import { type GoalOpeningSkill, keepOpeningFirst } from "./opening-graph";
import { type GoalSkillGraph } from "./save-goal-skills";

type GraphSkill = GoalSkillGraph["skills"][number];

function skill(attrs: Partial<GraphSkill> & Pick<GraphSkill, "key" | "name">): GraphSkill {
  return {
    area: "Immunology",
    course: "immunology",
    description: `${attrs.name}.`,
    estimatedLessons: 3,
    examWeight: null,
    level: "beginner",
    phase: 1,
    prerequisites: [],
    topics: [],
    ...attrs,
  };
}

const opening: GoalOpeningSkill = {
  course: { id: "course-id", key: "immunology", title: "Immunology" },
  skill: {
    area: "Germs",
    description: "Tell a pathogen from a harmless microbe.",
    estimatedLessons: 4,
    id: "skill-id",
    key: "pathogens",
    level: "beginner",
    name: "Identify pathogens",
  },
};

describe(keepOpeningFirst, () => {
  it("holds the graph's first skill to the opening as saved", () => {
    const graph: GoalSkillGraph = {
      courses: [{ key: "immunology", levels: ["beginner"], title: "Immunology" }],
      estimatedHours: 10,
      phases: [
        { estimatedHours: 5, milestone: "", title: "First steps" },
        { estimatedHours: 5, milestone: "", title: "Going further" },
      ],
      skills: [
        skill({ key: "antigens", name: "Explain antigens", prerequisites: ["pathogens"] }),
        skill({
          estimatedLessons: 6,
          key: "pathogens",
          name: "Spot pathogens",
          phase: 2,
          prerequisites: ["antigens"],
        }),
      ],
    };

    const kept = keepOpeningFirst({ graph, opening });

    expect(kept.graph.skills).toStrictEqual([
      {
        area: "Immunology",
        course: "immunology",
        description: "Tell a pathogen from a harmless microbe.",
        estimatedLessons: 6,
        examWeight: null,
        key: "pathogens",
        level: "beginner",
        libraryId: "skill-id",
        name: "Identify pathogens",
        outcome: false,
        phase: 1,
        prerequisites: [],
        topics: [],
      },
      graph.skills[0],
    ]);

    expect(kept.graph.courses).toStrictEqual(graph.courses);
    expect(kept.courseIdsByKey).toStrictEqual({ immunology: "course-id" });
    expect(kept.idsByKey).toStrictEqual({ pathogens: "skill-id" });
  });

  it("adds the opening and its course when the graph left them out", () => {
    const graph: GoalSkillGraph = {
      courses: [{ key: "biology", levels: ["beginner"], title: "Biology" }],
      estimatedHours: 5,
      phases: [{ estimatedHours: 5, milestone: "", title: "First steps" }],
      skills: [skill({ course: "biology", key: "cells", name: "Describe a cell" })],
    };

    const kept = keepOpeningFirst({ graph, opening });

    expect(kept.graph.skills.map((item) => [item.key, item.area, item.course])).toStrictEqual([
      ["pathogens", "Germs", "immunology"],
      ["cells", "Immunology", "biology"],
    ]);

    expect(kept.graph.courses.map((course) => course.key)).toStrictEqual(["immunology", "biology"]);
  });

  it("leaves a graph alone when there's no opening", () => {
    const graph: GoalSkillGraph = { courses: [], estimatedHours: 0, phases: [], skills: [] };

    expect(keepOpeningFirst({ graph, opening: null })).toStrictEqual({
      courseIdsByKey: {},
      graph,
      idsByKey: {},
    });
  });
});
