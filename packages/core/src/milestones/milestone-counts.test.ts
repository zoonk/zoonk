import { prisma } from "@zoonk/db";
import { learningEventFixture } from "@zoonk/testing/fixtures/learning-events";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { studySessionFixture } from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { assertReadBudget, countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { describe, expect, it } from "vitest";
import { getCheckpointReward } from "../checkpoints/checkpoint-reward";
import { getPassMark, hasPassedCheckpoint } from "../checkpoints/checkpoint-rules";
import { loadMilestoneCounts } from "./award-milestones";
import {
  GLASSES_TARGETS,
  type MilestoneCounts,
  getEarnedGlasses,
  getGlassesProgress,
} from "./milestone-rules";

const EMPTY_COUNTS: MilestoneCounts = {
  bigChallenges: 0,
  bossesWon: 0,
  capsulesOpened: 0,
  finalBossesWon: 0,
  fullMeals: 0,
};

async function rawCounts(userId: string): Promise<MilestoneCounts> {
  const [attempts, bigChallenges, capsulesOpened, fullMeals] = await Promise.all([
    prisma.learningEvent.findMany({
      where: {
        endedAt: { not: null },
        kind: "checkpoint",
        lessonKind: { in: ["boss", "finalBoss"] },
        userId,
      },
    }),
    prisma.learningEvent.count({
      where: { endedAt: { not: null }, lessonKind: "weeklyChallenge", userId },
    }),
    prisma.learningEvent.count({ where: { kind: "review", lessonKind: "capsule", userId } }),
    prisma.studySession.count({ where: { fullMealAt: { not: null }, userId } }),
  ]);

  const wins = attempts.filter((row) =>
    hasPassedCheckpoint({
      correct: row.correctAnswers,
      passMark: getPassMark(row.correctAnswers + row.incorrectAnswers),
    }),
  );

  return {
    bigChallenges,
    bossesWon: wins.length,
    capsulesOpened,
    finalBossesWon: wins.filter((row) => row.lessonKind === "finalBoss").length,
    fullMeals,
  };
}

async function expectCounts(userId: string, expectedRaw: MilestoneCounts): Promise<void> {
  const raw = await rawCounts(userId);
  expect(raw).toStrictEqual(expectedRaw);
  const measured = await countDatabaseStatements(() => loadMilestoneCounts(userId));
  assertReadBudget(measured, 4);
  expect(measured.statements).toBe(4);

  expect(measured.result).toStrictEqual({
    bigChallenges: Math.min(raw.bigChallenges, GLASSES_TARGETS.bigChallenges),
    bossesWon: Math.min(raw.bossesWon, GLASSES_TARGETS.bossesWon),
    capsulesOpened: Math.min(raw.capsulesOpened, GLASSES_TARGETS.capsulesOpened),
    finalBossesWon: Math.min(raw.finalBossesWon, GLASSES_TARGETS.finalBossesWon),
    fullMeals: Math.min(raw.fullMeals, GLASSES_TARGETS.fullMeals),
  });

  expect(getGlassesProgress(measured.result)).toStrictEqual(getGlassesProgress(raw));
  expect(getEarnedGlasses(measured.result)).toStrictEqual(getEarnedGlasses(raw));

  for (const kind of ["boss", "finalBoss", "weekly"] as const) {
    expect(getCheckpointReward({ counts: measured.result, kind })).toStrictEqual(
      getCheckpointReward({ counts: raw, kind }),
    );
  }
}

async function unfinishedEvent(attrs: Parameters<typeof learningEventFixture>[0]) {
  const row = await learningEventFixture(attrs);
  return prisma.learningEvent.update({ data: { endedAt: null }, where: { id: row.id } });
}

describe("saturated milestone counts preserve all consumer outputs", () => {
  it.each([-1, 0, 1])("capsules at target offset %i", async (offset) => {
    expect.hasAssertions();
    const user = await userFixture();
    const count = GLASSES_TARGETS.capsulesOpened + offset;

    const rows = await Promise.all(
      Array.from({ length: count }, () =>
        learningEventFixture({ kind: "review", lessonKind: "capsule", userId: user.id }),
      ),
    );

    await Promise.all([
      prisma.learningEvent.updateMany({
        data: { endedAt: null },
        where: { id: { in: rows.filter((_, index) => index % 2 === 0).map((row) => row.id) } },
      }),
      learningEventFixture({ kind: "lesson", lessonKind: "capsule", userId: user.id }),
      learningEventFixture({ kind: "review", lessonKind: "library", userId: user.id }),
    ]);

    await expectCounts(user.id, { ...EMPTY_COUNTS, capsulesOpened: count });
  });

  it.each([-1, 0, 1])("weekly completions at target offset %i", async (offset) => {
    expect.hasAssertions();
    const user = await userFixture();
    const count = GLASSES_TARGETS.bigChallenges + offset;

    await Promise.all([
      ...Array.from({ length: count }, () =>
        learningEventFixture({ kind: "mock", lessonKind: "weeklyChallenge", userId: user.id }),
      ),
      unfinishedEvent({ kind: "mock", lessonKind: "weeklyChallenge", userId: user.id }),
    ]);

    await expectCounts(user.id, { ...EMPTY_COUNTS, bigChallenges: count });
  });

  it.each([-1, 0, 1])("full meals at target offset %i", async (offset) => {
    expect.hasAssertions();
    const user = await userFixture();
    const count = GLASSES_TARGETS.fullMeals + offset;

    await Promise.all([
      ...Array.from({ length: count }, () =>
        studySessionFixture({ fullMealAt: new Date(), status: "active", userId: user.id }),
      ),
      studySessionFixture({ fullMealAt: null, status: "completed", userId: user.id }),
    ]);

    await expectCounts(user.id, { ...EMPTY_COUNTS, fullMeals: count });
  });

  describe.each(["boss", "finalBoss"] as const)("%s wins", (lessonKind) => {
    it.each([-1, 0, 1])(
      "at target offset %i with failed and unfinished attempts",
      async (offset) => {
        expect.hasAssertions();
        const user = await userFixture();

        const count =
          GLASSES_TARGETS[lessonKind === "boss" ? "bossesWon" : "finalBossesWon"] + offset;

        for (const index of Array.from({ length: count }, (_, value) => value)) {
          if (index > 0) {
            // oxlint-disable-next-line eslint/no-await-in-loop -- Preserve a failed attempt between the two wins.
            await learningEventFixture({
              correctAnswers: 3,
              incorrectAnswers: 7,
              kind: "checkpoint",
              lessonKind,
              userId: user.id,
            });
          }
          // oxlint-disable-next-line eslint/no-await-in-loop -- Keep the win after its preceding failed attempt.
          await learningEventFixture({
            correctAnswers: 8,
            incorrectAnswers: 2,
            kind: "checkpoint",
            lessonKind,
            userId: user.id,
          });
        }

        await Promise.all([
          learningEventFixture({
            correctAnswers: 3,
            incorrectAnswers: 7,
            kind: "checkpoint",
            lessonKind,
            userId: user.id,
          }),
          unfinishedEvent({
            correctAnswers: 8,
            incorrectAnswers: 2,
            kind: "checkpoint",
            lessonKind,
            userId: user.id,
          }),
          learningEventFixture({ kind: "review", lessonKind, userId: user.id }),
        ]);

        await expectCounts(user.id, {
          ...EMPTY_COUNTS,
          bossesWon: count,
          finalBossesWon: lessonKind === "finalBoss" ? count : 0,
        });
      },
    );
  });

  it("preserves canonical zero-question passing for both boss metrics", async () => {
    expect.hasAssertions();
    const user = await userFixture();

    await learningEventFixture({
      correctAnswers: 0,
      incorrectAnswers: 0,
      kind: "checkpoint",
      lessonKind: "finalBoss",
      userId: user.id,
    });

    await expectCounts(user.id, { ...EMPTY_COUNTS, bossesWon: 1, finalBossesWon: 1 });
  });

  it("reads only this learner's ledger even after referenced content is deleted", async () => {
    expect.hasAssertions();

    const [user, other, lesson] = await Promise.all([
      userFixture(),
      userFixture(),
      libraryLessonFixture(),
    ]);

    await Promise.all(
      [user, other].map((actor) =>
        Promise.all([
          learningEventFixture({
            contentIds: { lessonId: lesson.id },
            kind: "review",
            lessonKind: "capsule",
            userId: actor.id,
          }),
          learningEventFixture({
            contentIds: { lessonId: lesson.id },
            kind: "checkpoint",
            lessonKind: "finalBoss",
            userId: actor.id,
          }),
          learningEventFixture({
            contentIds: { lessonId: lesson.id },
            kind: "mock",
            lessonKind: "weeklyChallenge",
            userId: actor.id,
          }),
          studySessionFixture({ fullMealAt: new Date(), userId: actor.id }),
        ]),
      ),
    );

    await prisma.lesson.delete({ where: { id: lesson.id } });

    await expectCounts(user.id, {
      bigChallenges: 1,
      bossesWon: 1,
      capsulesOpened: 1,
      finalBossesWon: 1,
      fullMeals: 1,
    });
  });
});
