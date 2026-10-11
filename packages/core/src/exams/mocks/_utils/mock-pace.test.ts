import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { loadMockPace } from "./mock-pace";

const ANSWERS_PER_MOCK = 25;
const SECONDS = 1000;

/** A learner who finished one mock of the exam, answering every question in `seconds`. */
async function finishedMock({ blueprintId, seconds }: { blueprintId: string; seconds: number }) {
  const user = await userFixture();
  const finishedAt = new Date("2026-09-20T12:00:00Z");

  const mock = await prisma.mockExam.create({
    data: {
      conditions: {},
      examBlueprintId: blueprintId,
      finishedAt,
      sectionStartedAt: finishedAt,
      status: "finished",
      userId: user.id,
    },
  });

  await Promise.all(
    Array.from({ length: ANSWERS_PER_MOCK }, () =>
      attemptFixture({
        answeredAt: finishedAt,
        durationMs: seconds * SECONDS,
        mockExamId: mock.id,
        userId: user.id,
      }),
    ),
  );
}

describe(loadMockPace, () => {
  it("counts the mocks of learners who deleted their accounts, kept without them", async () => {
    const blueprint = await examBlueprintFixture();

    await Promise.all(
      Array.from({ length: 4 }, () => finishedMock({ blueprintId: blueprint.id, seconds: 60 })),
    );

    const [learnerKey, mockKey] = [randomUUID(), randomUUID()];

    await prisma.anonymousMockAnswer.createMany({
      data: Array.from({ length: ANSWERS_PER_MOCK }, () => ({
        durationMs: 120 * SECONDS,
        examBlueprintId: blueprint.id,
        finishedOn: new Date("2026-09-21T00:00:00Z"),
        learnerKey,
        mockKey,
      })),
    });

    // Four learners still here aren't enough; with the one who left, 125 answers average 72s.
    await expect(loadMockPace(blueprint.id)).resolves.toBeCloseTo(1.2, 5);
  });
});
