import { prisma } from "@zoonk/db";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { describe, expect, it } from "vitest";
import { recordNumericWrite } from "./numeric-skills";

async function readVerdict(skillId: string) {
  const skill = await prisma.skill.findUniqueOrThrow({ where: { id: skillId } });
  return skill.isQuantitative;
}

describe(recordNumericWrite, () => {
  it("marks a skill the writer found no one-number problem for, and one it stored such questions for", async () => {
    const [none, some] = await Promise.all([skillFixture(), skillFixture()]);

    await Promise.all([
      recordNumericWrite({ created: 0, generated: 0, skillId: none.id }),
      recordNumericWrite({ created: 2, generated: 3, skillId: some.id }),
    ]);

    await expect(readVerdict(none.id)).resolves.toBe(false);
    await expect(readVerdict(some.id)).resolves.toBe(true);
  });

  it("keeps the verdict when every written question failed its checks", async () => {
    const skill = await skillFixture();

    await recordNumericWrite({ created: 0, generated: 3, skillId: skill.id });

    await expect(readVerdict(skill.id)).resolves.toBeNull();
  });
});
