import { learningEventFixture } from "@zoonk/testing/fixtures/learning-events";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { loadFirstStepHistory } from "./first-step-history";

describe("the first challenge win", () => {
  it.each(["boss", "finalBoss", "weeklyChallenge"])(
    "does not count a lost %s",
    async (lessonKind) => {
      const user = await userFixture();

      await learningEventFixture({
        correctAnswers: 0,
        incorrectAnswers: 2,
        kind: "checkpoint",
        lessonKind,
        userId: user.id,
      });

      await expect(loadFirstStepHistory(user.id)).resolves.toMatchObject({
        doneAt: { challenge: undefined },
      });
    },
  );

  it("uses the first boss win after a loss, excluding weekly challenges", async () => {
    const user = await userFixture();
    const wonAt = new Date("2026-10-12T12:00:00Z");

    await Promise.all([
      learningEventFixture({
        correctAnswers: 0,
        endedAt: new Date("2026-10-10T12:00:00Z"),
        incorrectAnswers: 2,
        kind: "checkpoint",
        lessonKind: "boss",
        userId: user.id,
      }),
      learningEventFixture({
        correctAnswers: 3,
        endedAt: new Date("2026-10-11T12:00:00Z"),
        incorrectAnswers: 0,
        kind: "checkpoint",
        lessonKind: "weeklyChallenge",
        userId: user.id,
      }),
      learningEventFixture({
        correctAnswers: 3,
        endedAt: wonAt,
        incorrectAnswers: 0,
        kind: "checkpoint",
        lessonKind: "finalBoss",
        userId: user.id,
      }),
    ]);

    await expect(loadFirstStepHistory(user.id)).resolves.toMatchObject({
      doneAt: { challenge: wonAt },
    });
  });
});
