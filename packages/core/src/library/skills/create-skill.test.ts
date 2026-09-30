import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { scopeIdentityKey } from "@zoonk/utils/identity-key";
import { describe, expect, it } from "vitest";
import { addSkillPrerequisites, createSkill } from "./create-skill";

function skillInput(identityKey: string) {
  return {
    description: "Find what share of a total a part is",
    example: "12 of 48 is 25%",
    identityKey,
    language: "en",
    level: null,
    name: "Calculate a percentage",
    ownerId: null,
    provenance: {
      generatedAt: new Date(),
      model: "test/curriculum",
      promptVersion: "v1",
      runId: "r",
    },
    targetLanguage: null,
  };
}

describe(createSkill, () => {
  it("creates one skill per identity, even when two requests race", async () => {
    const identityKey = `test-skill-${randomUUID()}`;

    const results = await Promise.all([
      createSkill(skillInput(identityKey)),
      createSkill(skillInput(identityKey)),
    ]);

    expect(results[0].skill.id).toBe(results[1].skill.id);
    expect(results.filter((result) => result.created)).toHaveLength(1);
    expect(results[0].skill).toMatchObject({ normalizedName: "calculate a percentage" });
  });

  it("keeps a private course's skill private to its owner", async () => {
    const owner = await userFixture();
    const identityKey = scopeIdentityKey({ key: `test-skill-${randomUUID()}`, ownerId: owner.id });

    const { skill } = await createSkill({ ...skillInput(identityKey), ownerId: owner.id });

    expect(skill).toMatchObject({ ownerId: owner.id, visibility: "private" });
  });

  it("refuses a public key for a private skill", async () => {
    const owner = await userFixture();

    await expect(
      createSkill({ ...skillInput(`test-skill-${randomUUID()}`), ownerId: owner.id }),
    ).rejects.toThrow("owner's key space");
  });
});

describe(addSkillPrerequisites, () => {
  it("adds each prerequisite once and never the skill itself", async () => {
    const [skill, first, second] = await Promise.all([
      skillFixture(),
      skillFixture(),
      skillFixture(),
    ]);

    await addSkillPrerequisites({ prerequisiteIds: [first.id, skill.id], skillId: skill.id });
    await addSkillPrerequisites({ prerequisiteIds: [first.id, second.id], skillId: skill.id });

    const edges = await prisma.skillPrerequisite.findMany({ where: { skillId: skill.id } });

    expect(edges.map((edge) => edge.prerequisiteId).toSorted()).toStrictEqual(
      [first.id, second.id].toSorted(),
    );
  });
});
