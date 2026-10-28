import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { goalUnderstandingFixture } from "@zoonk/testing/fixtures/goal-understandings";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { normalizeString } from "@zoonk/utils/string";
import { describe, expect, it } from "vitest";
import { findCachedUnderstanding } from "./understanding-cache";

const RESULT = {
  followUps: [],
  goals: [{ kind: "exam", subject: "ENEM", title: "Pass the ENEM" }],
  route: "goals",
} as const;

async function readCached({ goal, userId }: { goal: string; userId: string }) {
  return findCachedUnderstanding({
    language: "en",
    normalizedPrompt: normalizeString(goal),
    now: new Date(),
    userId,
  });
}

describe(findCachedUnderstanding, () => {
  it("reuses today's reading of the same words for the learner who typed them", async () => {
    const user = await userFixture();
    const goal = `pass the enem ${randomUUID()}`;
    await goalUnderstandingFixture({ goal, result: RESULT, userId: user.id });

    await expect(readCached({ goal, userId: user.id })).resolves.toMatchObject({
      goals: [{ title: "Pass the ENEM" }],
    });
  });

  it("never gives another learner a reading of the same words, and goes away with its learner", async () => {
    const [user, other] = await Promise.all([userFixture(), userFixture()]);
    const goal = `pass the enem for medicine at ufmg ${randomUUID()}`;
    const row = await goalUnderstandingFixture({ goal, result: RESULT, userId: user.id });

    await expect(readCached({ goal, userId: other.id })).resolves.toBeNull();

    await prisma.user.delete({ where: { id: user.id } });

    await expect(
      prisma.goalUnderstanding.findUnique({ where: { id: row.id } }),
    ).resolves.toBeNull();
  });

  it("reuses today's reading whatever prompt version wrote it", async () => {
    const user = await userFixture();
    const goal = `pass the enem ${randomUUID()}`;
    const row = await goalUnderstandingFixture({ goal, result: RESULT, userId: user.id });

    await prisma.goalUnderstanding.update({
      data: { promptVersion: "000000000000" },
      where: { id: row.id },
    });

    await expect(readCached({ goal, userId: user.id })).resolves.toMatchObject({
      goals: [{ title: "Pass the ENEM" }],
    });
  });

  it("reads the words again after a day, when relative dates mean something else", async () => {
    const user = await userFixture();
    const goal = `pass the enem ${randomUUID()}`;
    const row = await goalUnderstandingFixture({ goal, result: RESULT, userId: user.id });

    await prisma.goalUnderstanding.update({
      data: { generatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) },
      where: { id: row.id },
    });

    await expect(readCached({ goal, userId: user.id })).resolves.toBeNull();
  });
});
