import { prisma } from "@zoonk/db";
import { planItemFixture } from "@zoonk/testing/fixtures/goals";
import { lessonSkillFixture, libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { itemFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { thirdsMath, thirdsQuestion } from "../library/items/_test-utils/math-problems";
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
import { getWeeklyChallenge } from "./get-weekly-challenge";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock("@zoonk/ai/tasks/v2/mistakes/cause", () => ({ classifyMistakeCause: vi.fn() }));

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
  mockSession(user.id);

  return { ...fixture, boss, user };
}

async function playCheckpoint({ goalId, optionIndex }: { goalId: string; optionIndex: number }) {
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

  it("puts the mock in the day's session for Plus learners", async () => {
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

    expect(today.status === "ready" && today.session.blocks.at(-1)).toMatchObject({
      checkpoint: { kind: "weekly", mock: true, timeLimitMinutes: 27 },
      kind: "checkpoint",
      questions: 9,
    });
  });

  // The player sends a mock to the mock screen: an answer to it as a checkpoint would check the
  // plan's mock off with no sitting, which preparation never counts.
  it("takes no study answer on a mock, which only the mock screen sits", async () => {
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

    const today = await getTodayStudySession({ goalId: goal.id });
    const block = today.status === "ready" ? today.session.blocks.at(-1) : undefined;
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
          sections: [{ day: null, minutes: 300, name: "Prova objetiva", questions: 80 }],
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
