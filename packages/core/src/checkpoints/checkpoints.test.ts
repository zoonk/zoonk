import { prisma } from "@zoonk/db";
import { layOutPlanFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { lessonSkillFixture, libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { itemFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { thirdsMath, thirdsQuestion } from "../library/items/_test-utils/math-problems";
import { loadMilestoneCounts } from "../milestones/award-milestones";
import { type SavedItemFacts } from "../plans/_utils/selected-item-contract";
import { answerBlockInOrder } from "../sessions/_test-utils/answer-block";
import { getTodayStudySession } from "../sessions/_test-utils/open-today";
import {
  DAY_MS,
  SESSION_NOW,
  SESSION_TODAY,
  checkpointItemFixture,
  sessionGoalFixture,
} from "../sessions/_test-utils/session-goal";
import { answerStudyQuestion } from "../sessions/answer-study-question";
import { getBlockItemIds, readBlockPayload } from "../sessions/block-payload";
import { BRAIN_POWER_BONUS } from "../sessions/brain-power";
import { finishStudyBlock } from "../sessions/finish-study-block";
import { getStudyBlock } from "../sessions/get-study-block";
import { startStudyBlock } from "../sessions/start-study-block";
import { getTodayView } from "../view-models/today/get-today-view";
import { findLastCheckpointResult } from "./_utils/checkpoint-results";
import { getChallenge } from "./get-challenge";
import { getCheckpoint } from "./get-checkpoint";
import { getWeeklyChallenge } from "./get-weekly-challenge";

/** A goal whose first phase (two lessons) is done, with its boss next and a lesson after it. */
async function bossSetup({ itemsPerSkill }: { itemsPerSkill?: number } = {}) {
  const user = await userFixture();
  const fixture = await sessionGoalFixture({ itemsPerSkill, lessons: 3, userId: user.id });
  const [first, second, third] = fixture.planItems;

  await prisma.planItem.update({ data: { phase: 1, position: 5 }, where: { id: third?.id } });

  await prisma.planItem.updateMany({
    data: { status: "done" },
    where: { id: { in: [first?.id ?? "", second?.id ?? ""] } },
  });

  const boss = await checkpointItemFixture({ kind: "boss", planId: fixture.plan.id, position: 2 });
  await layOutPlanFixture(fixture.plan.id);
  mockSession(user.id);

  return { ...fixture, boss, user };
}

async function playCheckpoint({
  count,
  goalId,
  optionIndex,
}: {
  /** Answers only the first ones, every question without it. */
  count?: number;
  goalId: string;
  optionIndex: number;
}) {
  const today = await getTodayStudySession({ goalId });

  if (today.status !== "ready") {
    throw new Error("Expected today's session");
  }

  const block = today.session.blocks.find((candidate) => candidate.kind === "checkpoint");

  if (!block) {
    throw new Error("Expected a checkpoint block");
  }

  await startStudyBlock({ blockId: block.id, input: {}, sessionId: today.session.id });
  const detail = await getStudyBlock({ blockId: block.id, sessionId: today.session.id });

  const feedback = await answerBlockInOrder({
    blockId: block.id,
    count,
    optionIndex,
    sessionId: today.session.id,
  });

  const result = await finishStudyBlock({
    blockId: block.id,
    input: {},
    sessionId: today.session.id,
  });

  return { block, detail, feedback, result, session: today.session };
}

describe("phase checkpoint (boss)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("is a duel without hints that, when won, checks the phase off and earns the Star glasses", async () => {
    const { boss, goal, user } = await bossSetup();

    const { block, detail, feedback, result, session } = await playCheckpoint({
      goalId: goal.id,
      optionIndex: 0,
    });

    expect(session.blocks.map((candidate) => candidate.kind)).toStrictEqual(["checkpoint"]);
    expect(block.checkpoint).toMatchObject({ kind: "boss", mock: false, passMark: 5, phase: 0 });
    expect(detail.status === "ready" && detail.detail.hints).toBe(false);

    expect(feedback[0]).toMatchObject({
      feedback: { correctAnswer: null, explanation: null, isCorrect: true },
    });

    if (result.status !== "ready") {
      throw new Error(`Expected the duel's result, got ${result.status}`);
    }

    expect(result.completion.checkpoint).toMatchObject({
      correct: 6,
      kind: "boss",
      passed: true,
      total: 6,
    });

    expect(result.completion.checkpoint?.answers[0]).toMatchObject({
      correctAnswer: { selectedIndex: 0 },
    });

    expect(result.completion.brainPower).toBeGreaterThanOrEqual(BRAIN_POWER_BONUS.phaseBoss);

    expect(
      result.completion.milestones.map((milestone) => [milestone.kind, milestone.key]),
    ).toStrictEqual(
      expect.arrayContaining([
        ["glasses", "star"],
        ["badge", `trapHunter:${boss.id}`],
      ]),
    );

    await expect(
      prisma.planItem.findUniqueOrThrow({ where: { id: boss.id } }),
    ).resolves.toMatchObject({ status: "done" });

    await expect(
      prisma.learningEvent.findFirst({ where: { kind: "checkpoint", userId: user.id } }),
    ).resolves.toMatchObject({ correctAnswers: 6, lessonKind: "boss" });
  });

  // Pedro's won challenge kept asking: the shield broke at question 7 with 3 questions left.
  it("ends once the shield breaks: won with questions left, it finishes at the duel's pass mark", async () => {
    const { boss, goal } = await bossSetup();
    const { block, result } = await playCheckpoint({ count: 5, goalId: goal.id, optionIndex: 0 });

    expect(block.checkpoint).toMatchObject({ passMark: 5 });
    expect(block.questions).toBe(6);

    expect(result).toMatchObject({
      completion: { checkpoint: { correct: 5, passMark: 5, passed: true, total: 5 } },
      status: "ready",
    });

    await expect(
      prisma.planItem.findUniqueOrThrow({ where: { id: boss.id } }),
    ).resolves.toMatchObject({ status: "done" });
  });

  // Two submissions of one answer at once can both be saved: each question breaks one piece.
  it("counts each question once toward breaking the shield", async () => {
    const { boss, goal, user } = await bossSetup();
    const today = await getTodayStudySession({ goalId: goal.id });
    const block = today.status === "ready" ? today.session.blocks[0] : undefined;

    if (!block || today.status !== "ready") {
      throw new Error("Expected today's checkpoint");
    }

    const ref = { blockId: block.id, sessionId: today.session.id };
    await startStudyBlock({ ...ref, input: {} });
    const [first] = await answerBlockInOrder({ ...ref, count: 4 });
    const detail = await getStudyBlock(ref);
    const questions = detail.status === "ready" ? detail.detail.questions : [];
    const [question] = questions;

    expect(first?.status).toBe("ready");

    await attemptFixture({
      itemId: question?.itemId,
      skillId: question?.skillId,
      studySessionId: today.session.id,
      userId: user.id,
    });

    await expect(finishStudyBlock({ ...ref, input: {} })).resolves.toStrictEqual({
      status: "unanswered",
    });

    // The last two missed: four of six right, the duplicate counted once, is a loss.
    await Promise.all(
      questions
        .slice(4)
        .map((rest) =>
          answerStudyQuestion({
            ...ref,
            input: { answer: { selectedIndex: 1 }, durationMs: 4000, itemId: rest.itemId },
          }),
        ),
    );

    await expect(finishStudyBlock({ ...ref, input: {} })).resolves.toMatchObject({
      completion: { checkpoint: { correct: 4, passed: false, total: 6 } },
      status: "ready",
    });

    await expect(
      prisma.planItem.findUniqueOrThrow({ where: { id: boss.id } }),
    ).resolves.toMatchObject({ status: "todo" });
  });

  it("asks every question while the shield holds", async () => {
    const { boss, goal } = await bossSetup();
    const { result } = await playCheckpoint({ count: 4, goalId: goal.id, optionIndex: 0 });

    expect(result).toStrictEqual({ status: "unanswered" });

    await expect(
      prisma.planItem.findUniqueOrThrow({ where: { id: boss.id } }),
    ).resolves.toMatchObject({ status: "todo" });
  });

  // The mirror of a won duel: Pedro's lost challenge kept asking, still promising its prize.
  it("ends once the shield can't break anymore: lost with questions left, it settles as a loss", async () => {
    const { boss, goal, lessons, user } = await bossSetup();

    // Five right of six win it: one miss leaves them all to get, the second decides it.
    const { block, detail, result, session } = await playCheckpoint({
      count: 1,
      goalId: goal.id,
      optionIndex: 1,
    });

    expect(block.checkpoint).toMatchObject({ passMark: 5 });
    expect(block.questions).toBe(6);
    expect(result).toStrictEqual({ status: "unanswered" });

    const ref = { blockId: block.id, sessionId: session.id };
    const second = detail.status === "ready" ? detail.detail.questions[1] : undefined;

    await answerStudyQuestion({
      ...ref,
      input: { answer: { selectedIndex: 1 }, durationMs: 4000, itemId: second?.itemId ?? "" },
    });

    const lost = await finishStudyBlock({ ...ref, input: {} });

    expect(lost).toMatchObject({
      completion: { checkpoint: { correct: 0, passMark: 5, passed: false, total: 2 } },
      status: "ready",
    });

    const milestones = lost.status === "ready" ? lost.completion.milestones : [];

    expect(
      milestones.filter((milestone) => milestone.kind === "badge" || milestone.kind === "glasses"),
    ).toStrictEqual([]);

    await expect(
      prisma.planItem.findUniqueOrThrow({ where: { id: boss.id } }),
    ).resolves.toMatchObject({ status: "todo" });

    await expect(
      prisma.learningEvent.findFirst({ where: { kind: "checkpoint", userId: user.id } }),
    ).resolves.toMatchObject({ correctAnswers: 0, incorrectAnswers: 2, lessonKind: "boss" });

    // As any loss: tomorrow, two short lessons on what it missed, then the rematch.
    vi.setSystemTime(new Date(SESSION_NOW.getTime() + DAY_MS));
    const tomorrow = await getTodayStudySession({ goalId: goal.id });

    if (tomorrow.status !== "ready") {
      throw new Error("Expected tomorrow's session");
    }

    const learn = tomorrow.session.blocks.filter((candidate) => candidate.kind === "learn");

    expect(learn.map((candidate) => [candidate.lessonId, candidate.reinforcement])).toStrictEqual([
      [lessons[0]?.id, true],
      [lessons[1]?.id, true],
      [lessons[2]?.id, false],
    ]);

    expect(tomorrow.session.blocks.at(-1)).toMatchObject({
      checkpoint: { kind: "boss", rematch: true },
      kind: "checkpoint",
    });
  });

  // A question the bank removed mid-duel (a picture that failed its checks) is never asked: the duel
  // is judged on the five left, seven of ten of them to win, so the screen, settlement and every
  // reader that judges a duel by its answers (the challenge's last result, milestones) agree.
  it("judges a duel on the questions it can still ask when one was removed", async () => {
    const { boss, goal, user } = await bossSetup();
    const today = await getTodayStudySession({ goalId: goal.id });
    const block = today.status === "ready" ? today.session.blocks[0] : undefined;

    if (!block || today.status !== "ready") {
      throw new Error("Expected today's checkpoint");
    }

    const ref = { blockId: block.id, sessionId: today.session.id };
    await startStudyBlock({ ...ref, input: {} });
    const started = await getStudyBlock(ref);
    const asked = started.status === "ready" ? started.detail.questions : [];

    await prisma.item.delete({ where: { id: asked.at(-1)?.itemId } });

    // The duel, its block and its challenge's intro all say four right of five.
    const shortened = await getCheckpoint(block.id);
    const view = shortened.status === "ready" ? shortened.checkpoint : null;
    expect([view?.passMark, view?.questions.length]).toStrictEqual([4, 5]);

    await expect(getStudyBlock(ref)).resolves.toMatchObject({
      detail: { block: { checkpoint: { passMark: 4 }, questions: 5 } },
    });

    await expect(getChallenge({ input: {}, planItemId: boss.id })).resolves.toMatchObject({
      challenge: { passMark: 4, questions: 5 },
    });

    const answer = (itemId: string | undefined, selectedIndex: number) =>
      answerStudyQuestion({
        ...ref,
        input: { answer: { selectedIndex }, durationMs: 4000, itemId: itemId ?? "" },
      });

    // Three right and a miss leave the fifth to reach four.
    await answerBlockInOrder({ ...ref, count: 3 });
    await answer(asked[3]?.itemId, 1);

    await expect(finishStudyBlock({ ...ref, input: {} })).resolves.toStrictEqual({
      status: "unanswered",
    });

    await answer(asked[4]?.itemId, 1);
    const lost = await finishStudyBlock({ ...ref, input: {} });

    expect(lost).toMatchObject({
      completion: { checkpoint: { correct: 3, passMark: 4, passed: false, total: 5 } },
      status: "ready",
    });

    const milestones = lost.status === "ready" ? lost.completion.milestones : [];

    expect(
      milestones.filter((milestone) => milestone.kind === "badge" || milestone.kind === "glasses"),
    ).toStrictEqual([]);

    await expect(
      findLastCheckpointResult({ planItemId: boss.id, userId: user.id }),
    ).resolves.toMatchObject({ correct: 3, passed: false, total: 5 });

    await expect(loadMilestoneCounts(user.id)).resolves.toMatchObject({ bossesWon: 0 });
  });

  // Reopened later, a finished duel says what settlement decided, whatever the bank removed since.
  it("keeps a lost duel lost when one of its answered questions is removed", async () => {
    const { goal } = await bossSetup();
    const today = await getTodayStudySession({ goalId: goal.id });
    const block = today.status === "ready" ? today.session.blocks[0] : undefined;

    if (!block || today.status !== "ready") {
      throw new Error("Expected today's checkpoint");
    }

    const ref = { blockId: block.id, sessionId: today.session.id };
    await startStudyBlock({ ...ref, input: {} });
    const started = await getStudyBlock(ref);
    const questions = started.status === "ready" ? started.detail.questions : [];
    await answerBlockInOrder({ ...ref, count: 3 });

    // Three right, then two misses: the one left can't reach five.
    await Promise.all(
      questions
        .slice(3, 5)
        .map((question) =>
          answerStudyQuestion({
            ...ref,
            input: { answer: { selectedIndex: 1 }, durationMs: 4000, itemId: question.itemId },
          }),
        ),
    );

    await expect(finishStudyBlock({ ...ref, input: {} })).resolves.toMatchObject({
      completion: { checkpoint: { correct: 3, passed: false, total: 5 } },
      status: "ready",
    });

    await prisma.item.delete({ where: { id: questions[4]?.itemId } });
    const reopened = await getCheckpoint(block.id);

    expect(reopened).toMatchObject({
      checkpoint: { result: { correct: 3, passed: false, total: 5 }, retry: "tomorrow" },
      status: "ready",
    });
  });

  it("costs nothing when lost: a rematch the next day after two short lessons on what it missed", async () => {
    const { boss, goal, lessons } = await bossSetup();
    const lost = await playCheckpoint({ goalId: goal.id, optionIndex: 1 });

    expect(lost.result).toMatchObject({
      completion: { checkpoint: { passed: false } },
      status: "ready",
    });

    await expect(
      prisma.planItem.findUniqueOrThrow({ where: { id: boss.id } }),
    ).resolves.toMatchObject({ status: "todo" });

    vi.setSystemTime(new Date(SESSION_NOW.getTime() + DAY_MS));
    const tomorrow = await getTodayStudySession({ goalId: goal.id });

    if (tomorrow.status !== "ready") {
      throw new Error("Expected tomorrow's session");
    }

    const learn = tomorrow.session.blocks.filter((block) => block.kind === "learn");

    // The duel's missed skills come back first; the next phase keeps going, never locked.
    expect(learn.map((block) => [block.lessonId, block.reinforcement])).toStrictEqual([
      [lessons[0]?.id, true],
      [lessons[1]?.id, true],
      [lessons[2]?.id, false],
    ]);

    expect(tomorrow.session.blocks.at(-1)).toMatchObject({
      checkpoint: { kind: "boss", rematch: true },
      kind: "checkpoint",
    });

    expect(tomorrow.session.localDate).toStrictEqual(new Date(SESSION_TODAY.getTime() + DAY_MS));
  });

  // r16-seed's thin bank: a phase whose skills held fewer than five questions lost its challenge
  // from the session without a word, while its page promised it for the next session, forever.
  it("holds a challenge whose questions aren't written yet, sized for the ten it asks", async () => {
    const { goal } = await bossSetup({ itemsPerSkill: 1 });
    const today = await getTodayStudySession({ goalId: goal.id });

    if (today.status !== "ready") {
      throw new Error("Expected today's session");
    }

    // Today's row says what it will ask, never "1 question" from the bank as it is (a walk saw "0").
    expect(today.session.blocks.find((block) => block.kind === "checkpoint")).toMatchObject({
      checkpoint: { kind: "boss", passMark: 7, phase: 0 },
      estimatedMinutes: 15,
      questions: 10,
    });
  });

  // A skill belongs to the phase of its first lesson, so a phase whose lessons go on with an
  // earlier skill had none of its own, and its challenge was never asked. The first phase's
  // challenge asked both skills, so it has none new to ask either.
  it("asks a phase that only goes on with earlier skills about what its lessons study", async () => {
    const user = await userFixture();

    const { goal, plan, planItems, skills } = await sessionGoalFixture({
      itemsPerSkill: 5,
      lessons: 2,
      userId: user.id,
    });

    const lesson = await libraryLessonFixture({ title: "Skill 1, further" });

    await Promise.all([
      lessonSkillFixture({ lessonId: lesson.id, skillId: skills[0]?.id ?? "" }),
      planItemFixture({
        kind: "lesson",
        lessonId: lesson.id,
        phase: 1,
        planId: plan.id,
        position: 3,
        status: "done",
        titleSnapshot: lesson.title,
      }),
      prisma.planItem.updateMany({
        data: { status: "done" },
        where: { id: { in: planItems.map((item) => item.id) } },
      }),
      planItemFixture({
        kind: "boss",
        phase: 0,
        planId: plan.id,
        position: 2,
        status: "done",
        titleSnapshot: "Phase 1 challenge",
      }),
      checkpointItemFixture({ kind: "boss", phase: 1, planId: plan.id, position: 4 }),
    ]);

    mockSession(user.id);
    const today = await getTodayStudySession({ goalId: goal.id });

    if (today.status !== "ready") {
      throw new Error("Expected today's session");
    }

    const block = today.session.blocks.find((candidate) => candidate.kind === "checkpoint");
    const row = await prisma.studySessionBlock.findUniqueOrThrow({ where: { id: block?.id } });
    const payload = readBlockPayload(row);

    expect(block?.checkpoint).toMatchObject({ kind: "finalBoss", phase: 1 });
    expect(payload.skillIds).toStrictEqual([skills[0]?.id]);
    expect(getBlockItemIds(payload)).toHaveLength(5);
  });

  // An exam's window of reviews and mocks has no lessons to finish, so its challenge counted as
  // reached from the plan's first day: held while its questions were written, it filled day 3.
  it("asks a phase with no lessons of its own on its day, not before", async () => {
    const user = await userFixture();
    const { goal, plan } = await sessionGoalFixture({ lessons: 2, userId: user.id });
    const day = new Date(SESSION_TODAY.getTime() + 2 * DAY_MS);

    await checkpointItemFixture({
      kind: "boss",
      phase: 1,
      planId: plan.id,
      position: 2,
      scheduledFor: day,
    });

    await layOutPlanFixture(plan.id);
    mockSession(user.id);

    const today = await getTodayStudySession({ goalId: goal.id });

    if (today.status !== "ready") {
      throw new Error("Expected today's session");
    }

    expect(today.session.blocks.map((block) => block.kind)).not.toContain("checkpoint");
    expect(today.session.blocks.map((block) => block.kind)).toContain("learn");

    vi.setSystemTime(new Date(SESSION_NOW.getTime() + 2 * DAY_MS));
    const onItsDay = await getTodayStudySession({ goalId: goal.id });

    if (onItsDay.status !== "ready") {
      throw new Error("Expected the session on the challenge's day");
    }

    expect(onItsDay.session.blocks.find((block) => block.kind === "checkpoint")).toMatchObject({
      checkpoint: { kind: "finalBoss", phase: 1 },
    });
  });

  // Career seed 1016: a half-studied day left the first phase's challenge, and the second phase
  // still ends today, as the learner saw it (R6), so the plan put both challenges on today. Asking
  // only the first quietly pushed the second and moved that phase's end.
  it("asks both challenges due today, the earlier phase's first", async () => {
    const user = await userFixture();

    const { goal, plan, planItems } = await sessionGoalFixture({
      itemsPerSkill: 5,
      lessons: 4,
      userId: user.id,
    });

    const [first, second, third, fourth] = planItems;

    await prisma.planItem.update({
      data: { phase: 1, position: 4, status: "done" },
      where: { id: third?.id },
    });

    await prisma.planItem.update({
      data: { phase: 1, position: 6, scheduledFor: new Date(SESSION_TODAY.getTime() + DAY_MS) },
      where: { id: fourth?.id },
    });

    await prisma.planItem.updateMany({
      data: { status: "done" },
      where: { id: { in: [first?.id ?? "", second?.id ?? ""] } },
    });

    const bosses = await Promise.all([
      checkpointItemFixture({
        kind: "boss",
        planId: plan.id,
        position: 2,
        scheduledFor: SESSION_TODAY,
      }),
      checkpointItemFixture({
        kind: "boss",
        phase: 1,
        planId: plan.id,
        position: 5,
        scheduledFor: SESSION_TODAY,
      }),
    ]);

    // Each challenge is named after its phase, as the planner names it: Today's rows tell them apart.
    await Promise.all(
      bosses.map((boss, phase) =>
        prisma.planItem.update({
          data: { titleSnapshot: ["Basics", "Practice"][phase] },
          where: { id: boss.id },
        }),
      ),
    );

    mockSession(user.id);
    const today = await getTodayStudySession({ goalId: goal.id });

    if (today.status !== "ready") {
      throw new Error("Expected today's session");
    }

    const challenges = today.session.blocks.filter((block) => block.kind === "checkpoint");

    expect(
      challenges.map((block) => [block.checkpoint?.kind, block.checkpoint?.phase, block.title]),
    ).toStrictEqual([
      ["boss", 0, "Basics"],
      ["finalBoss", 1, "Practice"],
    ]);
  });
});

describe(getWeeklyChallenge, () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("offers Plus for an exam's mock on the free plan instead of hiding it", async () => {
    const user = await userFixture();
    const { goal, plan } = await sessionGoalFixture({ goal: { kind: "exam" }, userId: user.id });

    await checkpointItemFixture({
      kind: "mock",
      planId: plan.id,
      position: 10,
      scheduledFor: SESSION_TODAY,
    });

    mockSession(user.id);

    const result = await getWeeklyChallenge({ goalId: goal.id });

    expect(result).toMatchObject({
      challenge: {
        access: "plusRequired",
        brainPower: BRAIN_POWER_BONUS.weeklyChallenge,
        checklist: ["waterAndSnack", "phoneOnSilent", "clearDesk", "clockInView"],
        date: SESSION_TODAY,
        kind: "mock",
      },
      status: "ready",
    });

    const today = await getTodayStudySession({ goalId: goal.id });

    expect(
      today.status === "ready" && today.session.blocks.some((block) => block.kind === "checkpoint"),
    ).toBe(false);
  });

  // The player sends a mock to the mock screen: an answer to it as a checkpoint would check the
  // plan's mock off with no sitting, which preparation never counts.
  it("puts the mock in the day's session for Plus learners, taking no study answer on it", async () => {
    const user = await userFixture();
    const { goal, plan } = await sessionGoalFixture({ goal: { kind: "exam" }, userId: user.id });

    await Promise.all([
      checkpointItemFixture({
        kind: "mock",
        planId: plan.id,
        position: 10,
        scheduledFor: SESSION_TODAY,
      }),
      prisma.subscription.create({
        data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
      }),
    ]);

    mockSession(user.id);

    const [challenge, today] = await Promise.all([
      getWeeklyChallenge({ goalId: goal.id }),
      getTodayStudySession({ goalId: goal.id }),
    ]);

    expect(challenge).toMatchObject({
      challenge: { access: "open", questions: 9 },
      status: "ready",
    });

    const block = today.status === "ready" ? today.session.blocks.at(-1) : undefined;

    expect(block).toMatchObject({
      checkpoint: { kind: "weekly", mock: true, timeLimitMinutes: 27 },
      kind: "checkpoint",
      questions: 9,
    });

    const sessionId = today.status === "ready" ? today.session.id : "";
    const row = await prisma.studySessionBlock.findUniqueOrThrow({ where: { id: block?.id } });

    await startStudyBlock({ blockId: row.id, input: {}, sessionId });

    const answer = await answerStudyQuestion({
      blockId: row.id,
      input: {
        answer: { selectedIndex: 0 },
        durationMs: 3000,
        itemId: getBlockItemIds(readBlockPayload(row))[0] ?? "",
      },
      sessionId,
    });

    expect(answer).toStrictEqual({ status: "invalidItem" });
  });

  it("says a mock days away is the exam's short mock, not the few questions the bank has today", async () => {
    const user = await userFixture();
    const citation = { passage: "80 questões em 5 horas", sourceId: "notice" };

    const blueprint = await examBlueprintFixture({
      structure: {
        formats: [{ citation, description: "Quatro opções", kind: "multipleChoice", options: 4 }],
        mock: {
          adaptive: false,
          citations: [citation],
          order: null,
          scoring: { description: "Um ponto por questão", method: "raw" },
          sections: [
            { day: null, kind: "objective", minutes: 300, name: "Prova objetiva", questions: 80 },
          ],
          timeLimitMinutes: 300,
          totalQuestions: 80,
        },
        rules: [],
        subjects: [],
      },
    });

    const { goal, plan } = await sessionGoalFixture({
      goal: { examBlueprintId: blueprint.id, kind: "exam" },
      userId: user.id,
    });

    await checkpointItemFixture({
      kind: "mock",
      planId: plan.id,
      position: 10,
      scheduledFor: new Date("2026-10-04T00:00:00Z"),
    });

    mockSession(user.id);

    await expect(getWeeklyChallenge({ goalId: goal.id })).resolves.toMatchObject({
      challenge: { conditions: { fullLength: false, questions: 40 }, questions: 40 },
      status: "ready",
    });
  });

  it("shows the mock of an exam whose notice gives formats but no layout, asking its numbers typed in", async () => {
    const user = await userFixture();
    const citation = { passage: "Marking scheme", sourceId: "notice" };

    // Like JEE Advanced's brochure: its answer formats, but no sections, size or time.
    const blueprint = await examBlueprintFixture({
      structure: {
        formats: [
          { citation, description: "One option correct", kind: "multipleChoice", options: 4 },
          {
            citation,
            description: "A non-negative integer, typed in",
            entry: { kind: "integer", places: null },
            kind: "numeric",
            options: null,
          },
        ],
        mock: null,
        rules: [],
        subjects: [],
      },
    });

    const { goal, plan, skills } = await sessionGoalFixture({
      goal: { examBlueprintId: blueprint.id, kind: "exam" },
      userId: user.id,
    });

    await Promise.all([
      checkpointItemFixture({
        kind: "mock",
        planId: plan.id,
        position: 10,
        scheduledFor: SESSION_TODAY,
      }),
      itemFixture({
        content: {
          context: null,
          entry: { kind: "integer", places: null },
          math: thirdsMath,
          otherSolutions: [],
          question: thirdsQuestion,
        },
        examBlueprintId: blueprint.id,
        format: "numeric",
        skillId: skills[0]?.id ?? "",
      }),
    ]);

    mockSession(user.id);

    await expect(getWeeklyChallenge({ goalId: goal.id })).resolves.toMatchObject({
      challenge: { conditions: { leftOut: [] }, kind: "mock" },
      status: "ready",
    });
  });

  // Today's week row said "10 questions" for a mixed challenge whose intro said 7, or no size.
  it("says the size its intro says for a mixed challenge, and none while that's unknown", async () => {
    const user = await userFixture();
    const { goal, plan, skills } = await sessionGoalFixture({ userId: user.id });

    const weekly = await checkpointItemFixture({
      kind: "checkpoint",
      planId: plan.id,
      position: 10,
      scheduledFor: new Date(SESSION_TODAY.getTime() + 3 * DAY_MS),
    });

    mockSession(user.id);

    const readSizes = async () => {
      const challenge = await getWeeklyChallenge({ goalId: goal.id });
      const today = await getTodayView({ goalId: goal.id, timeZone: "UTC" });

      return [
        challenge.status === "ready" ? challenge.challenge?.questions : null,
        today.status === "ready" ? today.today.weeklyChallenge?.questions : null,
      ];
    };

    await expect(readSizes()).resolves.toStrictEqual([null, null]);

    const skillIds = skills.map((skill) => skill.id);

    const facts: SavedItemFacts = {
      boss: {
        kind: "text",
        minutes: 7,
        questions: 7,
        testedKeys: [],
        testedSkillIds: skillIds,
        waiting: false,
      },
      minutes: 7,
      parts: { checkpoint: 7, practice: 0, unwritten: 0, written: 0 },
      schemaVersion: 1,
      skillIds,
    };

    await prisma.planItem.update({ data: { facts }, where: { id: weekly.id } });

    await expect(readSizes()).resolves.toStrictEqual([7, 7]);
  });

  it("has nothing to show without a weekly checkpoint in the plan", async () => {
    const user = await userFixture();
    const { goal } = await sessionGoalFixture({ userId: user.id });

    mockSession(user.id);

    await expect(getWeeklyChallenge({ goalId: goal.id })).resolves.toStrictEqual({
      challenge: null,
      status: "ready",
    });
  });
});
