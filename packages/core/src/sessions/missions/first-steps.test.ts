import { prisma } from "@zoonk/db";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { RENTING_SCENARIO } from "@zoonk/testing/fixtures/language";
import { mistakeFixture } from "@zoonk/testing/fixtures/learner";
import { learningEventFixture } from "@zoonk/testing/fixtures/learning-events";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { toBlockPayload } from "../block-payload";
import { loadDayMissionFacts } from "./day-facts";
import { loadFirstSteps } from "./first-steps";

const localDate = new Date("2026-10-13T00:00:00Z");
const now = new Date("2026-10-13T12:00:00Z");

const blocks = [
  {
    canDo: null,
    estimatedMinutes: 20,
    kind: "review" as const,
    lessonId: null,
    payload: toBlockPayload({}),
  },
];

async function learner() {
  const user = await userFixture();
  const goal = await goalFixture({ userId: user.id });
  await planFixture({ goalId: goal.id });
  return { goal, userId: user.id };
}

function load(input: Awaited<ReturnType<typeof learner>>) {
  return loadDayMissionFacts({
    ...input,
    blocks,
    localDate,
    now,
    plannedMinutes: 20,
    timeZone: "UTC",
  });
}

describe("First steps from real learner history", () => {
  it("keeps a finished list through the learner's local day its last step was done, then retires it", async () => {
    const input = await learner();
    const timeZone = "America/Sao_Paulo";

    await studySessionFixture({
      createdAt: new Date("2026-10-12T00:00:00Z"),
      goalId: input.goal.id,
      missions: { picks: [], version: 1 },
      startedAt: new Date("2026-10-12T00:00:00Z"),
      userId: input.userId,
    });

    const thread = await prisma.lessonQuestionThread.create({
      data: { goalId: input.goal.id, kind: "plan", userId: input.userId },
    });

    const earlier = new Date("2026-10-12T15:00:00Z");

    await Promise.all([
      learningEventFixture({ endedAt: earlier, kind: "lesson", userId: input.userId }),
      learningEventFixture({ endedAt: earlier, kind: "review", userId: input.userId }),
      mistakeFixture({ fixedAt: earlier, status: "fixed", userId: input.userId }),
      prisma.lessonQuestion.create({
        data: {
          contextKind: "plan",
          contextSnapshot: {},
          createdAt: new Date("2026-10-14T01:30:00Z"),
          question: "What should I study?",
          requestFingerprint: "first-step-done",
          requestId: crypto.randomUUID(),
          threadId: thread.id,
        },
      }),
    ]);

    const day = (isoDate: string, at: string) =>
      loadDayMissionFacts({
        ...input,
        blocks,
        localDate: new Date(`${isoDate}T00:00:00Z`),
        now: new Date(at),
        plannedMinutes: 20,
        timeZone,
      });

    const finished = await day("2026-10-13", "2026-10-14T02:00:00Z");

    expect(finished.firstSteps).toMatchObject({ completedOn: "2026-10-13", done: 4, total: 4 });
    expect(finished.firstSteps?.steps.every((step) => step.status === "done")).toBe(true);

    const nextDay = await day("2026-10-14", "2026-10-14T12:00:00Z");
    expect(nextDay.firstSteps).toBeNull();
  });

  it("keeps a retired list retired when a pattern is drilled again on a later day", async () => {
    const input = await learner();

    const goal = await prisma.goal.update({
      data: { kind: "language", targetLanguage: "en" },
      where: { id: input.goal.id },
    });

    await studySessionFixture({
      createdAt: new Date("2026-10-12T00:00:00Z"),
      goalId: goal.id,
      missions: { picks: [], version: 1 },
      startedAt: new Date("2026-10-12T00:00:00Z"),
      userId: input.userId,
    });

    const thread = await prisma.lessonQuestionThread.create({
      data: { goalId: goal.id, kind: "plan", userId: input.userId },
    });

    const firstDay = new Date("2026-10-13T15:00:00Z");

    const pattern = await prisma.mistakePattern.create({
      data: {
        content: { contrast: [], drill: [], examples: [], rule: "A rule." },
        goalId: goal.id,
        kind: "pattern",
        language: "en",
        model: "test",
        practicedAt: new Date("2026-10-15T15:00:00Z"),
        promptVersion: "test",
        runId: "test",
        title: "A pattern",
        userId: input.userId,
      },
    });

    const chapter = await libraryChapterFixture();

    await Promise.all([
      learningEventFixture({ endedAt: firstDay, kind: "lesson", userId: input.userId }),
      learningEventFixture({ endedAt: firstDay, kind: "review", userId: input.userId }),
      prisma.languageConversation.create({
        data: {
          chapterId: chapter.id,
          endedAt: firstDay,
          goalId: goal.id,
          kind: "practice",
          language: "pt",
          level: "A2",
          minutes: 2,
          objectivesMet: [],
          scenario: RENTING_SCENARIO,
          startedAt: firstDay,
          status: "completed",
          targetLanguage: "en",
          titleSnapshot: "A practice call",
          userId: input.userId,
        },
      }),
      learningEventFixture({
        contentIds: { mistakePatternId: pattern.id },
        endedAt: firstDay,
        kind: "questions",
        lessonKind: "patternDrill",
        userId: input.userId,
      }),
      learningEventFixture({
        contentIds: { mistakePatternId: pattern.id },
        endedAt: new Date("2026-10-15T15:00:00Z"),
        kind: "questions",
        lessonKind: "patternDrill",
        userId: input.userId,
      }),
      prisma.lessonQuestion.create({
        data: {
          contextKind: "plan",
          contextSnapshot: {},
          createdAt: firstDay,
          question: "What now?",
          requestFingerprint: "pattern-first-steps",
          requestId: crypto.randomUUID(),
          threadId: thread.id,
        },
      }),
    ]);

    const facts = await loadDayMissionFacts({
      ...input,
      blocks,
      goal,
      localDate: new Date("2026-10-15T00:00:00Z"),
      now: new Date("2026-10-15T18:00:00Z"),
      plannedMinutes: 20,
      timeZone: "UTC",
    });

    expect(facts.firstSteps).toBeNull();

    const finishedDay = await loadDayMissionFacts({
      ...input,
      blocks,
      goal,
      localDate: new Date("2026-10-13T00:00:00Z"),
      now: new Date("2026-10-13T18:00:00Z"),
      plannedMinutes: 20,
      timeZone: "UTC",
    });

    expect(finishedDay.firstSteps).toMatchObject({ completedOn: "2026-10-13" });
    expect(finishedDay.firstSteps?.done).toBe(finishedDay.firstSteps?.total);
  });

  it("does not restart when the first goal was deleted", async () => {
    const input = await learner();

    await studySessionFixture({
      goalId: input.goal.id,
      missions: { picks: [], version: 1 },
      startedAt: now,
      userId: input.userId,
    });

    await prisma.goal.delete({ where: { id: input.goal.id } });
    const second = await goalFixture({ userId: input.userId });
    const facts = await load({ ...input, goal: second });
    expect(facts.firstSteps).toBeNull();
  });

  it("counts placement mocks and offers the chooser only to Plus learners", async () => {
    const input = await learner();
    const goal = await prisma.goal.update({ data: { kind: "exam" }, where: { id: input.goal.id } });

    await studySessionFixture({
      createdAt: new Date("2026-10-12T00:00:00Z"),
      goalId: goal.id,
      missions: { picks: [], version: 1 },
      startedAt: now,
      userId: input.userId,
    });

    await learningEventFixture({
      endedAt: now,
      kind: "mock",
      lessonKind: "placement",
      userId: input.userId,
    });

    const done = await loadFirstSteps({
      candidates: [],
      goal,
      hasEssays: false,
      items: [],
      now,
      tier: "plus",
      timeZone: "UTC",
      userId: input.userId,
    });

    expect(done?.steps.find((step) => step.kind === "mock")?.status).toBe("done");

    const free = await loadFirstSteps({
      candidates: [],
      goal,
      hasEssays: false,
      items: [],
      now,
      tier: "free",
      timeZone: "UTC",
      userId: input.userId,
    });

    expect(free?.steps.some((step) => step.kind === "mock")).toBe(false);
  });

  it("counts a question sent before its answer starts metering usage", async () => {
    const input = await learner();

    const thread = await prisma.lessonQuestionThread.create({
      data: { goalId: input.goal.id, kind: "plan", userId: input.userId },
    });

    await prisma.lessonQuestion.create({
      data: {
        contextKind: "lesson",
        contextSnapshot: {},
        question: "How do I start?",
        requestFingerprint: "first-step-test",
        requestId: crypto.randomUUID(),
        threadId: thread.id,
      },
    });

    const facts = await load(input);

    expect(facts.firstSteps?.steps.find((step) => step.kind === "askBuddy")?.status).toBe("done");
  });

  it("does not count pronunciation as the first planned review", async () => {
    const input = await learner();

    await studySessionFixture({
      createdAt: new Date("2026-10-12T00:00:00Z"),
      goalId: input.goal.id,
      missions: { picks: [], version: 1 },
      startedAt: now,
      userId: input.userId,
    });

    await learningEventFixture({
      endedAt: now,
      kind: "review",
      lessonKind: "pronunciationReview",
      userId: input.userId,
    });

    const facts = await load(input);

    expect(facts.firstSteps?.steps.find((step) => step.kind === "review")?.status).toBe(
      "available",
    );
  });

  it("counts the first completed review block even when it only held placement", async () => {
    const input = await learner();

    const session = await studySessionFixture({
      goalId: input.goal.id,
      missions: { picks: [], version: 1 },
      startedAt: now,
      userId: input.userId,
    });

    await studySessionBlockFixture({ kind: "review", sessionId: session.id, status: "completed" });
    const facts = await load(input);

    expect(facts.firstSteps?.steps.find((step) => step.kind === "review")?.status).toBe("done");
  });

  it("offers first steps before a learner studies", async () => {
    const facts = await load(await learner());
    expect(facts.firstSteps).toMatchObject({ done: 0 });

    expect(facts.firstSteps?.steps.map((step) => step.kind)).toStrictEqual([
      "somethingNew",
      "review",
      "fixMistake",
      "askBuddy",
    ]);
  });

  it("keeps fresh-account progress on the next study day", async () => {
    const input = await learner();

    await studySessionFixture({
      createdAt: new Date("2026-10-13T00:00:00Z"),
      goalId: input.goal.id,
      localDate,
      missions: { picks: [], version: 1 },
      startedAt: now,
      userId: input.userId,
    });

    await learningEventFixture({ endedAt: now, kind: "lesson", userId: input.userId });

    const facts = await loadDayMissionFacts({
      ...input,
      blocks,
      localDate: new Date("2026-10-14T00:00:00Z"),
      now: new Date("2026-10-14T12:00:00Z"),
      plannedMinutes: 20,
      timeZone: "UTC",
    });

    expect(facts.firstSteps?.done).toBe(1);

    expect(facts.firstSteps?.steps.find((step) => step.kind === "somethingNew")?.status).toBe(
      "done",
    );
  });

  it("keeps the list available on an empty day while daily missions remain absent", async () => {
    const input = await learner();

    const facts = await loadDayMissionFacts({
      ...input,
      blocks: [],
      localDate,
      now,
      plannedMinutes: 0,
      timeZone: "UTC",
    });

    expect(facts.available).toBe(false);

    expect(facts.firstSteps?.steps.find((step) => step.kind === "askBuddy")?.status).toBe(
      "available",
    );
  });

  it("does not restart first steps on a second goal", async () => {
    const input = await learner();
    const second = await goalFixture({ userId: input.userId });
    const facts = await load({ ...input, goal: second });
    expect(facts.firstSteps).toBeNull();
  });

  it("counts learning before the first session toward first steps", async () => {
    const input = await learner();
    await learningEventFixture({ endedAt: now, userId: input.userId });
    const facts = await load(input);

    expect(facts.firstSteps?.steps.find((step) => step.kind === "somethingNew")?.status).toBe(
      "done",
    );
  });

  it("ends the list on the fourteenth account-wide study day", async () => {
    const input = await learner();

    await prisma.dailyProgress.createMany({
      data: Array.from({ length: 14 }, (_, index) => ({
        date: new Date(Date.UTC(2026, 9, index + 1)),
        dayOfWeek: new Date(Date.UTC(2026, 9, index + 1)).getUTCDay(),
        timeSpentSeconds: 60,
        userId: input.userId,
      })),
    });

    const facts = await load(input);
    expect(facts.firstSteps).toBeNull();
  });

  it("offers no missions on a paused plan", async () => {
    const input = await learner();

    const facts = await load({ ...input, goal: { ...input.goal, status: "paused" } });
    expect(facts.available).toBe(false);
  });
});
