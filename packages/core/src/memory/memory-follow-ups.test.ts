import { extractMemoryFacts } from "@zoonk/ai/tasks/memory/extraction";
import { generateMemoryInsight } from "@zoonk/ai/tasks/memory/insight";
import { type MemoryInsightOutput } from "@zoonk/ai/tasks/memory/insight-rules";
import { type SessionPattern, findSessionPatterns } from "@zoonk/ai/tasks/memory/session-patterns";
import { type LanguageConversationKind, prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { RENTING_SCENARIO } from "@zoonk/testing/fixtures/language";
import { attemptFixture, mistakeFixture } from "@zoonk/testing/fixtures/learner";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { freezeClock } from "../_test-utils/frozen-clock";
import { runSessionFollowUps } from "./_test-utils/session-follow-ups";
import { claimDailyInsight } from "./insights/daily-insight";
import {
  getSessionMemoryFollowUps,
  proposeCallMemory,
  rememberMemoryCandidate,
} from "./memory-follow-ups";

const DAY_MS = 86_400_000;
const NO_PATTERNS: SessionPattern[] = [];

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

async function learnerWithAnswers({
  answersPerDay,
  days,
}: {
  answersPerDay: number;
  days: number;
}) {
  const [user, skill] = await Promise.all([userFixture(), skillFixture({ name: "Percentages" })]);

  const goal = await goalFixture({
    language: "en",
    studyTime: "07:00",
    title: "ENEM 2026",
    userId: user.id,
  });

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

function endSessionFor({ goalId, userId }: { goalId: string; userId: string }) {
  return runSessionFollowUps({ goalId, userId });
}

function findInsights(userId: string) {
  return prisma.memoryInsight.findMany({ where: { userId } });
}

describe("memory after a session", () => {
  beforeEach(() => {
    vi.mocked(findSessionPatterns).mockResolvedValue({
      data: { patterns: NO_PATTERNS },
      provenance: PROVENANCE,
    } as Awaited<ReturnType<typeof findSessionPatterns>>);

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

    expect(findSessionPatterns).toHaveBeenCalledWith(
      expect.objectContaining({
        activity: expect.stringContaining("Answers in the last 7 days: 14 on 2 days, 50% right."),
      }),
    );

    expect(generateMemoryInsight).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        goal: "ENEM 2026",
        kinds: ["tip", "scheduleIdea"],
        language: "en",
        skills: [],
        studyTime: "07:00",
      }),
    );

    vi.mocked(generateMemoryInsight).mockClear();

    await endSessionFor({ goalId: goal.id, userId: user.id });

    expect(generateMemoryInsight).not.toHaveBeenCalled();
    await expect(findInsights(user.id)).resolves.toHaveLength(1);
  });

  it("reads a session without a goal for the active goal", async () => {
    const { goal, user } = await learnerWithAnswers({ answersPerDay: 7, days: 2 });
    await learningProfileFixture({ activeGoalId: goal.id, userId: user.id });

    const followUps = await getSessionMemoryFollowUps({
      endedAt: new Date("2026-09-26T23:30:00Z"),
      goalId: null,
      sessionId: goal.id,
      timeZone: "America/Sao_Paulo",
      userId: user.id,
    });

    expect(followUps).toStrictEqual([
      {
        input: {
          endedAt: "2026-09-26T23:30:00.000Z",
          goalId: goal.id,
          sessionId: goal.id,
          timeZone: "America/Sao_Paulo",
        },
        kind: "rememberSession",
      },
      {
        input: {
          date: "2026-09-26",
          endedAt: "2026-09-26T23:30:00.000Z",
          goalId: goal.id,
          timeZone: "America/Sao_Paulo",
        },
        kind: "checkDailyInsight",
      },
    ]);
  });

  it("runs no model on too little activity", async () => {
    const { goal, user } = await learnerWithAnswers({ answersPerDay: 12, days: 1 });

    await endSessionFor({ goalId: goal.id, userId: user.id });

    expect(findSessionPatterns).not.toHaveBeenCalled();
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

  it("throws a failed coach call and keeps the day's claim, which its retry resumes with its goal", async () => {
    const { goal, user } = await learnerWithAnswers({ answersPerDay: 7, days: 2 });
    const other = await goalFixture({ language: "en", userId: user.id });
    vi.mocked(generateMemoryInsight).mockRejectedValueOnce(new Error("Gateway down"));

    await expect(endSessionFor({ goalId: goal.id, userId: user.id })).rejects.toThrow(
      "Gateway down",
    );

    const [claimed] = await findInsights(user.id);
    expect(claimed).toMatchObject({ generatedAt: null, goalId: goal.id, message: null });

    const date = claimed?.localDate.toISOString().slice(0, 10) ?? "";
    const day = { endedAt: new Date().toISOString(), timeZone: "UTC", userId: user.id };

    await expect(claimDailyInsight({ ...day, date, goalId: other.id })).resolves.toStrictEqual({
      goalId: goal.id,
      id: claimed?.id,
    });

    await endSessionFor({ goalId: other.id, userId: user.id });

    await expect(findInsights(user.id)).resolves.toMatchObject([
      { goalId: goal.id, kind: "tip", model: "openai/gpt-6-luna" },
    ]);
  });

  it("does nothing while memory is off or for another learner's goal", async () => {
    const [{ goal, user }, stranger] = await Promise.all([
      learnerWithAnswers({ answersPerDay: 7, days: 2 }),
      userFixture(),
    ]);

    await endSessionFor({ goalId: goal.id, userId: stranger.id });
    await learningProfileFixture({ memoryEnabled: false, userId: user.id });
    await endSessionFor({ goalId: goal.id, userId: user.id });

    expect(findSessionPatterns).not.toHaveBeenCalled();
    expect(generateMemoryInsight).not.toHaveBeenCalled();

    await expect(
      prisma.memoryInsight.count({ where: { userId: { in: [user.id, stranger.id] } } }),
    ).resolves.toBe(0);
  });
});

const CALL_TURNS = [
  { speaker: "character" as const, text: "Hi! Are you calling about the apartment?" },
  { speaker: "learner" as const, text: "Yes. I move to Toronto next month for my job." },
];

async function practiceCall({
  kind = "practice",
  library = false,
}: { kind?: LanguageConversationKind; library?: boolean } = {}) {
  const user = await userFixture();

  const goal = library
    ? null
    : await goalFixture({
        kind: "language",
        language: "pt",
        targetLanguage: "en",
        timezone: "America/Sao_Paulo",
        userId: user.id,
      });

  const conversation = await prisma.languageConversation.create({
    data: {
      goalId: goal?.id,
      kind,
      language: "pt",
      level: "A2",
      minutes: 2,
      scenario: RENTING_SCENARIO,
      targetLanguage: "en",
      titleSnapshot: RENTING_SCENARIO.title,
      userId: user.id,
    },
  });

  return { conversationId: conversation.id, timeZone: "America/Sao_Paulo", userId: user.id };
}

describe(proposeCallMemory, () => {
  beforeEach(() => {
    vi.mocked(extractMemoryFacts).mockResolvedValue({
      data: {
        facts: [
          {
            category: "context",
            evidence: "I move to Toronto next month for my job",
            expiresOn: null,
            intent: "remember",
            origin: "said",
            statement: "Está se mudando para Toronto",
          },
        ],
      },
      provenance: PROVENANCE,
    } as Awaited<ReturnType<typeof extractMemoryFacts>>);
  });

  it("reads the call as the learner saw it and saves its facts as from that call", async () => {
    const call = await practiceCall();
    const { conversationId, userId } = call;

    const proposed = await proposeCallMemory({ ...call, turns: CALL_TURNS });

    expect(extractMemoryFacts).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        language: "pt",
        scenario: {
          objectives: RENTING_SCENARIO.objectives.map((objective) => objective.description),
          situation: RENTING_SCENARIO.situation,
        },
        source: "call",
        targetLanguage: "en",
        turns: CALL_TURNS,
      }),
    );

    const [candidate] = proposed?.candidates ?? [];

    if (!proposed || !candidate) {
      throw new Error("Expected a candidate from the call");
    }

    await rememberMemoryCandidate({
      candidate,
      context: proposed.context,
      gate: { sensitive: false },
    });

    await expect(prisma.memoryFact.findFirstOrThrow({ where: { userId } })).resolves.toMatchObject({
      origin: "said",
      sourceRef: { id: conversationId, kind: "call" },
      statement: "Está se mudando para Toronto",
    });
  });

  it("dates what it reads in the goal's time zone, else in the one the call ended in", async () => {
    freezeClock();
    vi.setSystemTime(new Date("2026-11-04T01:30:00Z"));

    const [goalCall, libraryCall] = await Promise.all([
      practiceCall(),
      practiceCall({ library: true }),
    ]);

    await proposeCallMemory({ ...goalCall, timeZone: "Asia/Tokyo", turns: CALL_TURNS });
    await proposeCallMemory({ ...libraryCall, timeZone: "America/Sao_Paulo", turns: CALL_TURNS });

    expect(vi.mocked(extractMemoryFacts).mock.calls.map(([params]) => params.today)).toStrictEqual([
      "2026-11-03",
      "2026-11-03",
    ]);
  });

  it("learns nothing from a mock, an exam task or a call where the learner never spoke", async () => {
    const [mock, examTask, silent] = await Promise.all([
      practiceCall({ kind: "speakingMock" }),
      practiceCall({ kind: "examSpeaking" }),
      practiceCall(),
    ]);

    const proposals = await Promise.all([
      proposeCallMemory({ ...mock, turns: CALL_TURNS }),
      proposeCallMemory({ ...examTask, turns: CALL_TURNS }),
      proposeCallMemory({ ...silent, turns: CALL_TURNS.slice(0, 1) }),
    ]);

    expect(proposals).toStrictEqual([null, null, null]);
    expect(extractMemoryFacts).not.toHaveBeenCalled();
  });

  it("learns nothing while memory is off or from another learner's call", async () => {
    const [call, stranger] = await Promise.all([practiceCall(), userFixture()]);
    await learningProfileFixture({ memoryEnabled: false, userId: call.userId });

    const proposals = await Promise.all([
      proposeCallMemory({ ...call, turns: CALL_TURNS }),
      proposeCallMemory({ ...call, turns: CALL_TURNS, userId: stranger.id }),
    ]);

    expect(proposals).toStrictEqual([null, null]);
    expect(extractMemoryFacts).not.toHaveBeenCalled();
  });
});
