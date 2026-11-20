import { describe, expect, it } from "vitest";
import { getPastBasicsSkillIds } from "./syllabus-known-skills";

describe(getPastBasicsSkillIds, () => {
  it("counts the situations a language plan leaves below the learner's level, unless they were taught", () => {
    const skill = { area: "English", lessons: 4, name: "Greetings", phase: 0, weight: null };

    const pastBasics = getPastBasicsSkillIds({
      graph: {
        phases: [{ milestone: null, name: "Beginner" }],
        skills: [
          { ...skill, pastLevel: true, skillId: "greetings" },
          { ...skill, pastLevel: true, skillId: "started" },
          { ...skill, skillId: "travel" },
        ],
      },
      items: [{ skillId: "started" }],
      prerequisites: new Map(),
      settings: { difficultyBias: "standard", pastBasicsAreas: [] },
    });

    expect([...pastBasics]).toStrictEqual(["greetings"]);
  });
});
