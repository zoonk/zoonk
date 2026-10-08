import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { goalUnderstandingFixture } from "@zoonk/testing/fixtures/goal-understandings";
import { normalizeString } from "@zoonk/utils/string";
import { describe, expect, it } from "vitest";
import { findCachedUnderstanding } from "./understanding-cache";

const RESULT = {
  followUps: [],
  goals: [{ kind: "exam", subject: "ENEM", title: "Pass the ENEM" }],
  route: "goals",
} as const;

async function readCached(goal: string) {
  return findCachedUnderstanding({
    language: "en",
    normalizedPrompt: normalizeString(goal),
    now: new Date(),
  });
}

describe(findCachedUnderstanding, () => {
  it("reuses today's reading of the same words by the current prompt", async () => {
    const goal = `pass the enem ${randomUUID()}`;
    await goalUnderstandingFixture({ goal, result: RESULT });

    await expect(readCached(goal)).resolves.toMatchObject({ goals: [{ title: "Pass the ENEM" }] });
  });

  it("reads the words again when an older prompt wrote the stored reading", async () => {
    const goal = `pass the enem ${randomUUID()}`;
    const row = await goalUnderstandingFixture({ goal, result: RESULT });

    await prisma.goalUnderstanding.update({
      data: { promptVersion: "000000000000" },
      where: { id: row.id },
    });

    await expect(readCached(goal)).resolves.toBeNull();
  });
});
