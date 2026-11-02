import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { loadMockPace } from "./mock-pace";

const ANSWERS_PER_MOCK = 25;
const SECONDS = 1000;

async function finishedMocks({
  blueprintId,
  learners,
  seconds,
}: {
  blueprintId: string;
  learners: number;
  seconds: number;
}) {
  const finishedAt = new Date("2026-09-20T12:00:00Z");
  const users = await Promise.all(Array.from({ length: learners }, () => userFixture()));

  const mocks = await Promise.all(
    users.map((user) =>
      prisma.mockExam.create({
        data: {
          conditions: {},
          examBlueprintId: blueprintId,
          finishedAt,
          sectionStartedAt: finishedAt,
          status: "finished",
          userId: user.id,
        },
      }),
    ),
  );

  await prisma.attempt.createMany({
    data: mocks.flatMap((mock) =>
      Array.from({ length: ANSWERS_PER_MOCK }, () => ({
        answer: { selectedIndex: 0 },
        answeredAt: finishedAt,
        durationMs: seconds * SECONDS,
        hour: finishedAt.getUTCHours(),
        isCorrect: true,
        localDate: new Date("2026-09-20T00:00:00Z"),
        mockExamId: mock.id,
        userId: mock.userId,
        weekday: finishedAt.getUTCDay(),
      })),
    ),
  });
}

describe(loadMockPace, () => {
  it("counts the mocks of learners who deleted their accounts, kept without them", async () => {
    const blueprint = await examBlueprintFixture();

    await finishedMocks({ blueprintId: blueprint.id, learners: 4, seconds: 60 });

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

    await expect(loadMockPace(blueprint.id)).resolves.toBeCloseTo(1.2, 5);
  });
});
