import { type ExtractedMemoryFact, extractMemoryFacts } from "@zoonk/ai/tasks/v2/memory/extraction";
import { generateMemoryInsight } from "@zoonk/ai/tasks/v2/memory/insight";
import { type MemoryInsightOutput } from "@zoonk/ai/tasks/v2/memory/insight-rules";
import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { attemptFixture, mistakeFixture } from "@zoonk/testing/fixtures/learner";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { logError } from "@zoonk/utils/logger";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { runDeferredWork } from "../_test-utils/deferred-work";
import { scheduleMemoryAfterSession } from "./after-session";

// Extraction and the coach are paid model calls; their behavior is covered by their evals.
vi.mock("@zoonk/ai/tasks/v2/memory/extraction", () => ({ extractMemoryFacts: vi.fn() }));
vi.mock("@zoonk/ai/tasks/v2/memory/insight", () => ({ generateMemoryInsight: vi.fn() }));

vi.mock("@zoonk/utils/logger", () => ({ logError: vi.fn(), logWarning: vi.fn() }));

const DAY_MS = 86_400_000;
const NO_FACTS: ExtractedMemoryFact[] = [];

const PROVENANCE = {
  generatedAt: "2026-09-26T12:00:00.000Z",
  model: "openai/gpt-6-luna",
  promptVersion: "memory-insight-test",
  runId: "run-insight-test",
};

function mockInsight(output: Partial<MemoryInsightOutput>) {
  vi.mocked(generateMemoryInsight).mockResolvedValue({
    data: {
      kind: "tip",
      lessonFocus: null,
      message: "You miss the last questions more often. Try a short break before them.",
      skill: null,
      studyTime: null,
      ...output,
    },
    provenance: PROVENANCE,
  } as Awaited<ReturnType<typeof generateMemoryInsight>>);
}

/** An adult with a goal on one skill and answers over the last `days` days. */
async function learnerWithAnswers({
  answersPerDay,
  days,
}: {
  answersPerDay: number;
  days: number;
}) {
  const [user, skill] = await Promise.all([userFixture(), skillFixture({ name: "Percentages" })]);

  const [goal] = await Promise.all([
    goalFixture({ language: "en", studyTime: "07:00", title: "ENEM 2026", userId: user.id }),
    learningProfileFixture({ birthMonth: 5, birthYear: 1990, userId: user.id }),
  ]);

  const plan = await planFixture({ goalId: goal.id });
  await planItemFixture({ planId: plan.id, skillId: skill.id });

  // Noon UTC keeps every answer of a day on that day, whenever the test runs.
  const todayNoon = new Date().setUTCHours(12, 0, 0, 0);

  const answers = Array.from({ length: days * answersPerDay }, (_, index) => {
    const day = Math.floor(index / answersPerDay);
    const answeredAt = new Date(todayNoon - day * DAY_MS - index * 1000);

    return attemptFixture({
      answeredAt,
      isCorrect: index % 2 === 0,
      skillId: skill.id,
      userId: user.id,
    });
  });

  await Promise.all([
    ...answers,
    mistakeFixture({ cause: "gap", skillId: skill.id, userId: user.id }),
  ]);

  return { goal, skill, user };
}

/** A session ends: memory reads it after the response, which the test waits for. */
async function endSession(request: Parameters<typeof scheduleMemoryAfterSession>[0]) {
  const settle = runDeferredWork();
  scheduleMemoryAfterSession(request);
  await settle();
}

function endSessionFor({ goalId, userId }: { goalId: string; userId: string }) {
  return endSession({ goalId, sessionId: null, timeZone: "UTC", userId });
}

function findInsights(userId: string) {
  return prisma.memoryInsight.findMany({ where: { userId } });
}

describe(scheduleMemoryAfterSession, () => {
  beforeEach(() => {
    vi.mocked(extractMemoryFacts).mockResolvedValue({
      data: { facts: NO_FACTS },
      provenance: PROVENANCE,
    } as Awaited<ReturnType<typeof extractMemoryFacts>>);

    mockInsight({});
  });

  it("notices patterns and proposes one insight a day from the week's numbers", async () => {
    const { goal, user } = await learnerWithAnswers({ answersPerDay: 7, days: 2 });

    await endSessionFor({ goalId: goal.id, userId: user.id });

    await expect(findInsights(user.id)).resolves.toMatchObject([
      {
        goalId: goal.id,
        kind: "tip",
        model: "openai/gpt-6-luna",
        promptVersion: "memory-insight-test",
        status: "pending",
      },
    ]);

    expect(extractMemoryFacts).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.stringContaining("Answers in the last 7 days: 14 on 2 days, 50% right."),
        source: "session",
      }),
    );

    expect(generateMemoryInsight).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        goal: "ENEM 2026",
        kinds: ["tip", "scheduleIdea"],
        language: "en",
        // The plan already teaches Percentages and it has no prerequisite to add.
        skills: [],
        studyTime: "07:00",
      }),
    );

    vi.mocked(generateMemoryInsight).mockClear();

    await endSessionFor({ goalId: goal.id, userId: user.id });

    // The second session the same day spends no call.
    expect(generateMemoryInsight).not.toHaveBeenCalled();
    await expect(findInsights(user.id)).resolves.toHaveLength(1);
  });

  it("checks the active goal for a session without one", async () => {
    const { goal, user } = await learnerWithAnswers({ answersPerDay: 7, days: 2 });
    await learningProfileFixture({ activeGoalId: goal.id, userId: user.id });

    await endSession({ goalId: null, sessionId: null, timeZone: "UTC", userId: user.id });
    await expect(findInsights(user.id)).resolves.toMatchObject([{ goalId: goal.id }]);
  });

  it("runs no model on too little activity", async () => {
    const { goal, user } = await learnerWithAnswers({ answersPerDay: 12, days: 1 });

    await endSessionFor({ goalId: goal.id, userId: user.id });

    expect(extractMemoryFacts).not.toHaveBeenCalled();
    expect(generateMemoryInsight).not.toHaveBeenCalled();
  });

  it("skips the call when nothing changed since the last check", async () => {
    const { goal, user } = await learnerWithAnswers({ answersPerDay: 7, days: 2 });

    await endSessionFor({ goalId: goal.id, userId: user.id });

    await prisma.memoryInsight.updateMany({
      data: { localDate: new Date(Date.now() - 3 * DAY_MS) },
      where: { userId: user.id },
    });

    await endSessionFor({ goalId: goal.id, userId: user.id });

    expect(generateMemoryInsight).toHaveBeenCalledOnce();
  });

  it("stores a schedule idea with the time to move to", async () => {
    const { goal, user } = await learnerWithAnswers({ answersPerDay: 7, days: 2 });
    mockInsight({ kind: "scheduleIdea", message: "Want to study at 8 pm?", studyTime: "20:00" });

    await endSessionFor({ goalId: goal.id, userId: user.id });

    const insight = await prisma.memoryInsight.findFirstOrThrow({ where: { userId: user.id } });
    expect(insight).toMatchObject({ kind: "scheduleIdea", payload: { studyTime: "20:00" } });
  });

  it("keeps the day's check without an insight when the coach has nothing valid to say", async () => {
    const { goal, user } = await learnerWithAnswers({ answersPerDay: 7, days: 2 });
    mockInsight({ kind: "scheduleIdea", message: "Keep studying at 7 am.", studyTime: "07:00" });

    await endSessionFor({ goalId: goal.id, userId: user.id });

    await expect(findInsights(user.id)).resolves.toMatchObject([{ kind: null, message: null }]);
  });

  it("logs a failed coach call and releases the day, so a later session can try again", async () => {
    const { goal, user } = await learnerWithAnswers({ answersPerDay: 7, days: 2 });
    vi.mocked(generateMemoryInsight).mockRejectedValue(new Error("Gateway down"));

    await endSessionFor({ goalId: goal.id, userId: user.id });

    expect(logError).toHaveBeenCalledWith(
      `Could not run memory after a session for learner ${user.id}.`,
      expect.any(Error),
    );

    await expect(prisma.memoryInsight.count({ where: { userId: user.id } })).resolves.toBe(0);
  });

  it("does nothing while memory is off or for another learner's goal", async () => {
    const [{ goal, user }, stranger] = await Promise.all([
      learnerWithAnswers({ answersPerDay: 7, days: 2 }),
      userFixture(),
    ]);

    await endSessionFor({ goalId: goal.id, userId: stranger.id });
    await learningProfileFixture({ memoryEnabled: false, userId: user.id });
    await endSessionFor({ goalId: goal.id, userId: user.id });

    expect(extractMemoryFacts).not.toHaveBeenCalled();
    expect(generateMemoryInsight).not.toHaveBeenCalled();

    await expect(
      prisma.memoryInsight.count({ where: { userId: { in: [user.id, stranger.id] } } }),
    ).resolves.toBe(0);
  });
});
