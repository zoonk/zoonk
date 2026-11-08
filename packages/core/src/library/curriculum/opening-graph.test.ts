import { describe, expect, it } from "vitest";
import { type GoalOpeningPin, pinGraphToOpening } from "./opening-graph";
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

const graph: GoalSkillGraph = {
  courses: [
    { key: "biology", levels: ["beginner"], title: "Biology" },
    { key: "immunology", levels: ["beginner"], title: "Immunology" },
  ],
  estimatedHours: 10,
  phases: [
    { estimatedHours: 5, milestone: "", title: "First steps" },
    { estimatedHours: 5, milestone: "", title: "Going further" },
  ],
  skills: [
    skill({ course: "biology", key: "cells", name: "Describe what a cell is" }),
    skill({ key: "pathogens", name: "Identify pathogens", prerequisites: ["cells"] }),
    skill({ key: "antigens", name: "Explain antigens", phase: 2, prerequisites: ["pathogens"] }),
  ],
};

const pin: GoalOpeningPin = {
  course: { id: "course-id", key: "immuno", levels: ["overview"], title: "immunology" },
  skill: {
    ...skill({ area: "Germs", course: "immuno", key: "pathogens", name: "Identify pathogens!" }),
    libraryId: "skill-id",
  },
};

describe(pinGraphToOpening, () => {
  it("starts the graph with the saved opening in place of the graph's own copy", () => {
    const pinned = pinGraphToOpening({ graph, pin });

    expect(
      pinned.graph.skills.map(({ key, phase, prerequisites }) => [key, phase, prerequisites]),
    ).toStrictEqual([
      ["pathogens", 1, []],
      ["cells", 1, []],
      ["antigens", 2, ["pathogens"]],
    ]);

    expect(pinned.graph.skills[0]).toMatchObject({
      area: "Immunology",
      course: "immunology",
      libraryId: "skill-id",
      name: "Identify pathogens!",
    });

    expect(pinned.graph.courses).toStrictEqual([
      { key: "immunology", levels: ["beginner", "overview"], title: "Immunology" },
      { key: "biology", levels: ["beginner"], title: "Biology" },
    ]);

    expect(pinned.courseIdsByKey).toStrictEqual({ immunology: "course-id" });
    expect(pinned.idsByKey).toStrictEqual({ pathogens: "skill-id" });
  });

  it("adds the opening's course and keeps its key apart from an unrelated skill's", () => {
    const pinned = pinGraphToOpening({
      graph,
      pin: {
        ...pin,
        course: { ...pin.course, key: "biology", title: "Virology" },
        skill: { ...pin.skill, key: "cells", name: "Spot a virus" },
      },
    });

    expect(pinned.graph.skills.map((item) => item.key)).toStrictEqual([
      "cells-opening",
      "cells",
      "pathogens",
      "antigens",
    ]);

    expect(pinned.graph.courses.map((course) => course.key)).toStrictEqual([
      "biology-opening",
      "biology",
      "immunology",
    ]);

    expect(pinned.idsByKey).toStrictEqual({ "cells-opening": "skill-id" });
  });

  it("gives the same graph when pinned again, as after the twins merge", () => {
    const once = pinGraphToOpening({ graph, pin });
    expect(pinGraphToOpening({ graph: once.graph, pin })).toStrictEqual(once);
  });

  it("leaves a graph alone when there's no opening", () => {
    expect(pinGraphToOpening({ graph, pin: null })).toStrictEqual({
      courseIdsByKey: {},
      graph,
      idsByKey: {},
    });
  });
});
