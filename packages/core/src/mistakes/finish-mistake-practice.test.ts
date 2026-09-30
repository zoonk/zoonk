import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { attemptFixture, mistakeFixture } from "@zoonk/testing/fixtures/learner";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { answerMistakePractice } from "./answer-mistake-practice";
import { finishMistakePractice } from "./finish-mistake-practice";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));

// The classifier is a paid model call; its behavior is covered by its eval.
vi.mock("@zoonk/ai/tasks/v2/mistakes/cause", () => ({ classifyMistakeCause: vi.fn() }));

const YESTERDAY = new Date(Date.now() - 86_400_000);
const RIGHT = { selectedIndex: 0 };
const WRONG = { selectedIndex: 1 };

/** A learner with one open mistake from yesterday and two questions on its skill. */
async function setup() {
  const [user, skill] = await Promise.all([userFixture(), skillFixture()]);

  const [original, extra] = await Promise.all([
    itemFixture({ content: choiceItemContent(), skillId: skill.id }),
    itemFixture({ content: choiceItemContent(), skillId: skill.id }),
  ]);

  const mistake = await mistakeFixture({
    cause: "misread",
    createdAt: YESTERDAY,
    itemId: original.id,
    skillId: skill.id,
    userId: user.id,
  });

  mockSession(user.id);

  return { extra, mistake, original, skill, user };
}

async function answer({
  answer: choice,
  itemId,
  mistakeId,
}: {
  answer: { selectedIndex: number };
  itemId: string;
  mistakeId: string;
}): Promise<string> {
  const result = await answerMistakePractice({
    input: { answer: choice, durationMs: 20_000, itemId, timeZone: "UTC" },
    mistakeId,
  });

  if (result.status !== "ready") {
    throw new Error(`The answer wasn't graded: ${result.status}`);
  }

  return result.feedback.answerId;
}

function loadToday(userId: string) {
  return prisma.dailyProgress.findUnique({
    where: { userDate: { date: getDateInTimeZone({ date: new Date(), timeZone: "UTC" }), userId } },
  });
}

function loadRuns(userId: string) {
  return prisma.learningEvent.findMany({ where: { lessonKind: "mistakePractice", userId } });
}

describe(finishMistakePractice, () => {
  it("counts a run like practice: today's totals, a learning day, Brain Power and the ledger", async () => {
    const { extra, mistake, original, user } = await setup();

    const answerIds = [
      await answer({ answer: RIGHT, itemId: original.id, mistakeId: mistake.id }),
      await answer({ answer: WRONG, itemId: extra.id, mistakeId: mistake.id }),
    ];

    const result = await finishMistakePractice({ answerIds, timeZone: "UTC" });

    expect(result).toMatchObject({
      result: { brainPower: 2, correct: 1, total: 2 },
      status: "ready",
    });

    const seconds = result.status === "ready" ? result.result.seconds : 0;
    expect(seconds).toBeGreaterThanOrEqual(20);

    await expect(loadToday(user.id)).resolves.toMatchObject({
      brainPowerEarned: 2,
      correctAnswers: 1,
      incorrectAnswers: 1,
      interactiveCompleted: 1,
      timeSpentSeconds: seconds,
    });

    const progress = await prisma.userProgress.findUniqueOrThrow({ where: { userId: user.id } });
    expect(progress.totalBrainPower).toBe(2n);
    expect(progress.currentEnergy).toBeCloseTo(0.1);

    const runs = await loadRuns(user.id);

    expect(runs).toHaveLength(1);

    expect(runs[0]).toMatchObject({
      brainPower: 2,
      correctAnswers: 1,
      incorrectAnswers: 1,
      kind: "questions",
      seconds,
    });

    expect(runs[0]?.endedAt).not.toBeNull();
    expect(runs[0]?.energyDelta).toBeCloseTo(0.1);
  });

  it("counts a run stopped early, so a partial day still counts", async () => {
    const { mistake, original, user } = await setup();
    const answerId = await answer({ answer: RIGHT, itemId: original.id, mistakeId: mistake.id });

    await expect(
      finishMistakePractice({ answerIds: [answerId], timeZone: "UTC" }),
    ).resolves.toMatchObject({ result: { correct: 1, total: 1 }, status: "ready" });

    await expect(loadToday(user.id)).resolves.toMatchObject({ interactiveCompleted: 1 });
  });

  it("counts a run once, however often or however fast it's finished", async () => {
    const { extra, mistake, original, user } = await setup();

    const first = await answer({ answer: RIGHT, itemId: original.id, mistakeId: mistake.id });
    const second = await answer({ answer: RIGHT, itemId: extra.id, mistakeId: mistake.id });
    const input = { answerIds: [first, second], timeZone: "UTC" };

    const [once, twice] = await Promise.all([
      finishMistakePractice(input),
      finishMistakePractice(input),
    ]);

    expect(twice).toStrictEqual(once);
    await expect(finishMistakePractice(input)).resolves.toStrictEqual(once);

    await expect(loadRuns(user.id)).resolves.toHaveLength(1);

    await expect(loadToday(user.id)).resolves.toMatchObject({
      correctAnswers: 2,
      interactiveCompleted: 1,
    });
  });

  it("grows one run as it's finished after every answer, counting each answer once", async () => {
    const { extra, mistake, original, user } = await setup();

    const first = await answer({ answer: RIGHT, itemId: original.id, mistakeId: mistake.id });

    await expect(
      finishMistakePractice({ answerIds: [first], timeZone: "UTC" }),
    ).resolves.toMatchObject({ result: { brainPower: 2, correct: 1, total: 1 }, status: "ready" });

    const second = await answer({ answer: RIGHT, itemId: extra.id, mistakeId: mistake.id });

    // Hyperdrive carries on across the run: the second right answer in a row pays double.
    await expect(
      finishMistakePractice({ answerIds: [first, second], ended: true, timeZone: "UTC" }),
    ).resolves.toMatchObject({ result: { brainPower: 6, correct: 2, total: 2 }, status: "ready" });

    await expect(loadToday(user.id)).resolves.toMatchObject({
      brainPowerEarned: 6,
      correctAnswers: 2,
      incorrectAnswers: 0,
      interactiveCompleted: 1,
    });

    const runs = await loadRuns(user.id);

    expect(runs).toMatchObject([{ brainPower: 6, correctAnswers: 2, incorrectAnswers: 0 }]);
    expect(runs[0]?.contentIds).toStrictEqual({ answerIds: `${first},${second}` });
  });

  it("won't count another learner's answers", async () => {
    const { mistake, original } = await setup();
    const answerId = await answer({ answer: RIGHT, itemId: original.id, mistakeId: mistake.id });
    const stranger = await userFixture();

    mockSession(stranger.id);

    await expect(
      finishMistakePractice({ answerIds: [answerId], timeZone: "UTC" }),
    ).resolves.toStrictEqual({ status: "invalid" });

    await expect(loadRuns(stranger.id)).resolves.toHaveLength(0);
    await expect(loadToday(stranger.id)).resolves.toBeNull();
  });

  it("won't count answers given outside mistake practice", async () => {
    const { user } = await setup();
    const otherSkill = await skillFixture();
    const otherItem = await itemFixture({ content: choiceItemContent(), skillId: otherSkill.id });

    const elsewhere = await attemptFixture({
      isCorrect: true,
      itemId: otherItem.id,
      skillId: otherSkill.id,
      userId: user.id,
    });

    await expect(
      finishMistakePractice({ answerIds: [elsewhere.id], timeZone: "UTC" }),
    ).resolves.toStrictEqual({ status: "invalid" });

    await expect(loadRuns(user.id)).resolves.toHaveLength(0);
  });

  it("files the run under the learner's own goal only", async () => {
    const { mistake, original, user } = await setup();
    const answerId = await answer({ answer: RIGHT, itemId: original.id, mistakeId: mistake.id });

    const [goal, strangersGoal] = await Promise.all([
      goalFixture({ userId: user.id }),
      userFixture().then((stranger) => goalFixture({ userId: stranger.id })),
    ]);

    await expect(
      finishMistakePractice({ answerIds: [answerId], goalId: strangersGoal.id, timeZone: "UTC" }),
    ).resolves.toStrictEqual({ status: "notFound" });

    await finishMistakePractice({ answerIds: [answerId], goalId: goal.id, timeZone: "UTC" });

    await expect(loadRuns(user.id)).resolves.toMatchObject([{ goalId: goal.id }]);
  });

  it("needs a signed-in learner", async () => {
    mockSession(null);

    await expect(
      finishMistakePractice({ answerIds: [crypto.randomUUID()], timeZone: "UTC" }),
    ).resolves.toStrictEqual({ status: "unauthorized" });
  });
});
