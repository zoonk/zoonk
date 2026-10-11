import { prisma } from "@zoonk/db";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { describe, expect, it } from "vitest";
import { linkGoalSkillPrerequisites } from "./save-goal-skills";

function graphSkill(key: string, prerequisites: string[] = []) {
  return { key, prerequisites };
}

async function listPrerequisiteIds(skillId: string): Promise<string[]> {
  const edges = await prisma.skillPrerequisite.findMany({ where: { skillId } });
  return edges.map((edge) => edge.prerequisiteId).toSorted();
}

describe(linkGoalSkillPrerequisites, () => {
  it("lets the newest graph decide the edges between its own skills", async () => {
    const [ecology, functions, tissues, chemistry] = await Promise.all([
      skillFixture(),
      skillFixture(),
      skillFixture(),
      skillFixture(),
    ]);

    // An older graph put ecology behind comparing living beings' functions, and a graph without
    // functions put it behind chemistry.
    await prisma.skillPrerequisite.createMany({
      data: [
        { prerequisiteId: functions.id, skillId: ecology.id },
        { prerequisiteId: chemistry.id, skillId: ecology.id },
      ],
    });

    await linkGoalSkillPrerequisites({
      idsByKey: { ecology: ecology.id, functions: functions.id, tissues: tissues.id },
      skills: [graphSkill("ecology"), graphSkill("functions", ["tissues"]), graphSkill("tissues")],
    });

    const [ecologyNeeds, functionsNeed] = await Promise.all([
      listPrerequisiteIds(ecology.id),
      listPrerequisiteIds(functions.id),
    ]);

    expect(ecologyNeeds).toStrictEqual([chemistry.id]);
    expect(functionsNeed).toStrictEqual([tissues.id]);
  });

  it("keeps what each key of a skill learned in several courses lists", async () => {
    const [skill, first, second] = await Promise.all([
      skillFixture(),
      skillFixture(),
      skillFixture(),
    ]);

    await linkGoalSkillPrerequisites({
      idsByKey: { first: first.id, second: second.id, skill: skill.id, "skill:math": skill.id },
      skills: [
        graphSkill("skill", ["first", "skill"]),
        graphSkill("skill:math", ["second"]),
        graphSkill("first"),
        graphSkill("second"),
      ],
    });

    await expect(listPrerequisiteIds(skill.id)).resolves.toStrictEqual(
      [first.id, second.id].toSorted(),
    );
  });
});
