import { prisma } from "@zoonk/db";
import { listeningGoalFixture } from "@zoonk/testing/fixtures/listening";
import { describe, expect, it } from "vitest";
import { loadListeningSkillIds, loadListeningSkills } from "./listening-skills";

describe(loadListeningSkillIds, () => {
  it("returns the goal's skills in its exam's listening area, the ones its recordings are written on", async () => {
    const { blueprint, goal, listeningSkills } = await listeningGoalFixture();

    const [skillIds, written] = await Promise.all([
      loadListeningSkillIds(goal.id),
      loadListeningSkills({ examBlueprintId: blueprint.id, sectionName: "Listening" }),
    ]);

    expect(skillIds).toStrictEqual(new Set(listeningSkills.map((skill) => skill.id)));
    expect(new Set(written.map((skill) => skill.skillId))).toStrictEqual(skillIds);
  });

  it("returns none for a learner's own notice, which never gets recordings", async () => {
    const { blueprint, goal } = await listeningGoalFixture();

    await prisma.examBlueprint.update({
      data: { visibility: "private" },
      where: { id: blueprint.id },
    });

    await expect(loadListeningSkillIds(goal.id)).resolves.toStrictEqual(new Set());
  });

  it("returns none for an exam goal that isn't for a language", async () => {
    const { goal } = await listeningGoalFixture();

    await prisma.goal.update({ data: { targetLanguage: null }, where: { id: goal.id } });

    await expect(loadListeningSkillIds(goal.id)).resolves.toStrictEqual(new Set());
  });

  it("returns none for an exam without a listening section", async () => {
    const { blueprint, goal } = await listeningGoalFixture();

    await prisma.examBlueprint.update({
      data: {
        structure: {
          formats: [],
          mock: {
            adaptive: false,
            citations: [],
            order: null,
            scoring: { description: "Bands", method: "scaled" },
            sections: [
              {
                day: null,
                kind: "objective",
                minutes: 60,
                name: "Reading",
                questions: 40,
                tasks: [],
              },
            ],
            timeLimitMinutes: null,
            totalQuestions: 40,
          },
          rules: [],
          subjects: [],
        },
      },
      where: { id: blueprint.id },
    });

    await expect(loadListeningSkillIds(goal.id)).resolves.toStrictEqual(new Set());
  });
});
