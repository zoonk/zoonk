import { auth } from "@zoonk/auth";
import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { RENTING_SCENARIO } from "@zoonk/testing/fixtures/language";
import { attemptFixture, mistakeFixture } from "@zoonk/testing/fixtures/learner";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { headers } from "next/headers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanupTestCalls,
  connectTestCall,
  setupTestCalls,
  testCallCompletionInput,
} from "../_test-utils/connect-test-call";
import { completeLanguageConversation } from "../language/conversations/complete-language-conversation";
import { getLanguageConversation } from "../language/conversations/get-language-conversation";
import { practiceMistakePattern } from "../language/patterns/practice-mistake-pattern";
import { finishPronunciationRound } from "../language/pronunciation/finish-pronunciation-round";
import { createLessonQuestion } from "../lesson-questions/create-lesson-question";
import { getBuddyStatus } from "../milestones/get-buddy-status";
import { loadMissionMoment } from "../sessions/missions/mission-moment";
import { settleLearnerMissions } from "../sessions/missions/settle-learner-missions";
import { answerMistakePractice } from "./answer-mistake-practice";
import { finishMistakePractice } from "./finish-mistake-practice";

/** Next has no request scope in Vitest; authentication and activity persistence remain real. */
vi.unmock("../users/get-session");
vi.mock("@zoonk/auth", () => import("../../../auth/src/testing"));

const NOW = new Date("2026-10-13T01:00:00.000Z");
const TODAY = new Date("2026-10-12T00:00:00.000Z");
const TIME_ZONE = "America/Sao_Paulo";

async function signedInLearner() {
  const user = await userFixture();
  const goal = await goalFixture({ timezone: TIME_ZONE, userId: user.id });
  await learningProfileFixture({ activeGoalId: goal.id, userId: user.id });

  const signedIn = await auth.api.signInEmail({
    body: { email: user.email, password: user.password },
    returnHeaders: true,
  });

  const cookie = signedIn.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");

  vi.mocked(headers).mockResolvedValue(new Headers({ cookie }));

  return { goal, user };
}

async function missionDay({
  anchor = {},
  goalId,
  kind,
  localDate = TODAY,
  userId,
}: {
  anchor?: Record<string, string>;
  goalId: string;
  kind: "askBuddy" | "call" | "pattern" | "pronunciation";
  localDate?: Date;
  userId: string;
}) {
  const day = await studySessionFixture({
    goalId,
    localDate,
    missions: { picks: [{ anchor, kind, total: 1 }], version: 1 },
    userId,
  });

  await studySessionBlockFixture({ sessionId: day.id });
  return day;
}

async function expectMissionPaid({ dayId, userId }: { dayId: string; userId: string }) {
  const [day, progress] = await Promise.all([
    prisma.studySession.findUniqueOrThrow({ where: { id: dayId } }),
    prisma.dailyProgress.findUniqueOrThrow({ where: { userDate: { date: TODAY, userId } } }),
  ]);

  expect(day.fullMealAt).not.toBeNull();
  expect(day.status).toBe("planned");
  expect(day.endedAt).toBeNull();
  expect(progress.brainPowerEarned).toBeGreaterThanOrEqual(50);
}

/** A target-scoped PostgreSQL failure exercises the committed activity and reward rollback. */
async function interruptMissionPayout({
  dayId,
  finish,
  missionsOnly = false,
}: {
  dayId: string;
  finish: () => Promise<unknown>;
  missionsOnly?: boolean;
}) {
  const identifier = `mission_payout_test_${crypto.randomUUID().replaceAll("-", "")}`;

  // DDL identifiers cannot be query parameters; both interpolated values are test-owned UUIDs.
  await prisma.$executeRawUnsafe(`
    CREATE FUNCTION ${identifier}() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF NEW.id = '${dayId}'::uuid AND ${missionsOnly ? "NEW.missions IS DISTINCT FROM OLD.missions" : "NEW.full_meal_at IS NOT NULL"} THEN
        RAISE EXCEPTION 'mission payout interrupted';
      END IF;
      RETURN NEW;
    END;
    $$
  `);

  try {
    await prisma.$executeRawUnsafe(
      `CREATE TRIGGER ${identifier} BEFORE UPDATE ON study_sessions FOR EACH ROW EXECUTE FUNCTION ${identifier}()`,
    );

    await expect(finish()).rejects.toThrow("mission payout interrupted");
  } finally {
    await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${identifier} ON study_sessions`);
    await prisma.$executeRawUnsafe(`DROP FUNCTION ${identifier}()`);
  }
}

describe("missions completed outside a study block", () => {
  beforeEach(async () => {
    await setupTestCalls();
    vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
    vi.mocked(headers).mockResolvedValue(new Headers());
  });

  afterEach(async () => {
    await cleanupTestCalls();
    vi.useRealTimers();
  });

  it("pays the last notebook mission immediately, once across goals, without closing the session", async () => {
    const { goal, user } = await signedInLearner();
    const skill = await skillFixture();
    const item = await itemFixture({ content: choiceItemContent(), skillId: skill.id });
    const secondGoal = await goalFixture({ timezone: TIME_ZONE, userId: user.id });

    const missions = {
      picks: [
        { anchor: { blockKind: "review" }, kind: "review", total: 1 },
        { anchor: {}, kind: "fixMistake", total: 1 },
      ],
      version: 1,
    };

    const [day, otherDay, mistake] = await Promise.all([
      studySessionFixture({ goalId: goal.id, localDate: TODAY, missions, userId: user.id }),
      studySessionFixture({ goalId: secondGoal.id, localDate: TODAY, missions, userId: user.id }),
      mistakeFixture({
        cause: "misread",
        createdAt: new Date("2026-10-11T18:00:00.000Z"),
        itemId: item.id,
        skillId: skill.id,
        userId: user.id,
      }),
    ]);

    await Promise.all([
      studySessionBlockFixture({ kind: "review", sessionId: day.id, status: "completed" }),
      studySessionBlockFixture({ kind: "review", sessionId: otherDay.id, status: "completed" }),
    ]);

    const answered = await answerMistakePractice({
      input: { answer: { selectedIndex: 0 }, durationMs: 5000, itemId: item.id, timeZone: "UTC" },
      mistakeId: mistake.id,
    });

    expect(answered).toMatchObject({ feedback: { mistakeStatus: "fixed" }, status: "ready" });

    if (answered.status !== "ready") {
      throw new Error(`Mistake answer failed: ${answered.status}`);
    }

    const input = { answerIds: [answered.feedback.answerId], ended: true, timeZone: "UTC" };
    const result = await finishMistakePractice(input);

    expect(result).toMatchObject({
      result: {
        brainPower: 2,
        correct: 1,
        missionMoment: { completed: ["fixMistake"], fullMeal: { bonus: 50, paid: true } },
        total: 1,
      },
      status: "ready",
    });

    await expect(finishMistakePractice(input)).resolves.toStrictEqual(result);

    const [progress, days, runs, daily] = await Promise.all([
      prisma.userProgress.findUniqueOrThrow({ where: { userId: user.id } }),
      prisma.studySession.findMany({ where: { userId: user.id } }),
      prisma.learningEvent.findMany({ where: { lessonKind: "mistakePractice", userId: user.id } }),
      prisma.dailyProgress.findUniqueOrThrow({
        where: { userDate: { date: TODAY, userId: user.id } },
      }),
    ]);

    expect(progress.totalBrainPower).toBe(52n);
    expect(daily.brainPowerEarned).toBe(52);
    expect(days.filter((session) => session.fullMealAt !== null)).toHaveLength(1);

    expect(days.every((session) => session.status === "planned" && session.endedAt === null)).toBe(
      true,
    );

    expect(runs).toHaveLength(1);
  });

  it("pays the final pattern mission as soon as its drill is stored", async () => {
    const { goal, user } = await signedInLearner();

    const pattern = await prisma.mistakePattern.create({
      data: {
        content: {
          contrast: [],
          drill: [
            {
              answer: "since",
              feedback: "A starting date.",
              options: ["since", "for"],
              sentence: "I've lived here ___ 2020.",
            },
          ],
          examples: [],
          rule: "Use since for a starting date.",
        },
        goalId: goal.id,
        kind: "pattern",
        language: "en",
        model: "test",
        promptVersion: "test",
        runId: "test",
        title: "Since and for",
        userId: user.id,
      },
    });

    const day = await missionDay({
      anchor: { patternId: pattern.id },
      goalId: goal.id,
      kind: "pattern",
      userId: user.id,
    });

    const input = { answers: ["since"], requestId: crypto.randomUUID(), timeZone: "UTC" };
    const result = await practiceMistakePattern({ input, patternId: pattern.id });

    expect(result).toMatchObject({
      result: {
        brainPower: 2,
        missionMoment: {
          completed: ["pattern"],
          fullMeal: { bonus: 50, paid: true },
          missions: [{ kind: "pattern", status: "done" }],
        },
      },
      status: "ready",
    });

    await expectMissionPaid({ dayId: day.id, userId: user.id });

    // "Try again" after a lost response sends the same drill: it counts once, with its result
    // (the mission it completed included).
    const retries = await Promise.all([
      practiceMistakePattern({ input, patternId: pattern.id }),
      practiceMistakePattern({ input, patternId: pattern.id }),
    ]);

    expect(retries).toStrictEqual([result, result]);

    const [drills, progress, daily] = await Promise.all([
      prisma.learningEvent.count({ where: { lessonKind: "patternDrill", userId: user.id } }),
      prisma.userProgress.findUniqueOrThrow({ where: { userId: user.id } }),
      prisma.dailyProgress.findUniqueOrThrow({
        where: { userDate: { date: TODAY, userId: user.id } },
      }),
    ]);

    expect(drills).toBe(1);
    expect(progress.totalBrainPower).toBe(52n);
    expect(daily.timeSpentSeconds).toBe(180);

    // The id names one pattern's drill: another pattern sent with it counts as its own drill.
    const other = await prisma.mistakePattern.create({
      data: {
        content: {
          contrast: [],
          drill: [
            {
              answer: "for",
              feedback: "A length of time.",
              options: ["since", "for"],
              sentence: "I've lived here ___ two years.",
            },
          ],
          examples: [],
          rule: "Use for with a length of time.",
        },
        goalId: goal.id,
        kind: "pattern",
        language: "en",
        model: "test",
        promptVersion: "test",
        runId: "test",
        title: "For a length of time",
        userId: user.id,
      },
    });

    await expect(
      practiceMistakePattern({ input: { ...input, answers: ["for"] }, patternId: other.id }),
    ).resolves.toMatchObject({ result: { correct: 1, total: 1 }, status: "ready" });

    await expect(
      prisma.learningEvent.count({ where: { lessonKind: "patternDrill", userId: user.id } }),
    ).resolves.toBe(2);
  });

  it.each([true, false])(
    "keeps pronunciation points separate from its mission bonus (correct: %s)",
    async (isCorrect) => {
      const { goal, user } = await signedInLearner();
      const day = await missionDay({ goalId: goal.id, kind: "pronunciation", userId: user.id });
      const roundId = crypto.randomUUID();

      await attemptFixture({ answer: { roundId }, isCorrect, userId: user.id });

      const input = { goalId: goal.id, timeZone: "UTC" };

      const results = await Promise.all([
        finishPronunciationRound({ input, roundId }),
        finishPronunciationRound({ input, roundId }),
      ]);

      expect(results[0]).toMatchObject({
        result: {
          brainPower: isCorrect ? 2 : 0,
          correct: isCorrect ? 1 : 0,
          missionMoment: { completed: ["pronunciation"], fullMeal: { bonus: 50, paid: true } },
          total: 1,
        },
        status: "ready",
      });

      expect(results[1]).toStrictEqual(results[0]);

      await expectMissionPaid({ dayId: day.id, userId: user.id });
      await finishPronunciationRound({ input, roundId });

      await expect(
        prisma.learningEvent.count({
          where: { lessonKind: "pronunciationReview", userId: user.id },
        }),
      ).resolves.toBe(1);

      await expect(
        prisma.userProgress.findUniqueOrThrow({ where: { userId: user.id } }),
      ).resolves.toMatchObject({ totalBrainPower: isCorrect ? 52n : 50n });
    },
  );

  it("says which mission an activity completed before the last one, and nothing for one that completed none", async () => {
    const { goal, user } = await signedInLearner();
    const [{ lesson }, roundId] = [await playableLessonFixture(), crypto.randomUUID()];

    await studySessionFixture({
      goalId: goal.id,
      localDate: TODAY,
      missions: {
        picks: [
          { anchor: {}, kind: "pronunciation", total: 1 },
          { anchor: {}, kind: "review", total: 1 },
        ],
        version: 1,
      },
      userId: user.id,
    });

    await attemptFixture({ answer: { roundId }, userId: user.id });

    const round = await finishPronunciationRound({
      input: { goalId: goal.id, timeZone: "UTC" },
      roundId,
    });

    expect(round).toMatchObject({
      result: {
        missionMoment: {
          completed: ["pronunciation"],
          fullMeal: { bonus: 50, paid: false },
          missions: [
            { kind: "pronunciation", status: "done" },
            { kind: "review", status: "todo" },
          ],
        },
      },
      status: "ready",
    });

    const question = await createLessonQuestion({
      input: { context: { kind: "lesson" }, question: "Why?", requestId: crypto.randomUUID() },
      target: { kind: "lesson", lessonId: lesson.id },
    });

    expect(question).toMatchObject({ missionMoment: null, status: "created" });
  });

  it("credits each activity only with its own mission when another one settles first", async () => {
    const { goal, user } = await signedInLearner();
    const roundId = crypto.randomUUID();
    const questionId = crypto.randomUUID();

    const day = await studySessionFixture({
      goalId: goal.id,
      localDate: TODAY,
      missions: {
        picks: [
          { anchor: {}, kind: "pronunciation", total: 1 },
          { anchor: {}, kind: "askBuddy", total: 1 },
        ],
        version: 1,
      },
      userId: user.id,
    });

    await studySessionBlockFixture({ sessionId: day.id });

    // A question asked on another tab is stored, its own settlement not run yet.
    await prisma.usageRecord.create({
      data: { createdAt: new Date(), kind: "tutorMessage", targetId: questionId, userId: user.id },
    });

    await attemptFixture({ answer: { roundId }, userId: user.id });

    const round = await finishPronunciationRound({
      input: { goalId: goal.id, timeZone: "UTC" },
      roundId,
    });

    // The round settles both missions and pays, but takes credit only for its own.
    expect(round).toMatchObject({
      result: {
        missionMoment: { completed: ["pronunciation"], fullMeal: { bonus: 50, paid: true } },
      },
      status: "ready",
    });

    const source = { id: questionId, kind: "buddyQuestion" };
    await settleLearnerMissions({ source, timeZone: "UTC", userId: user.id });

    await expect(
      loadMissionMoment({ source, timeZone: "UTC", userId: user.id }),
    ).resolves.toMatchObject({ completed: ["askBuddy"], fullMeal: { paid: false } });
  });

  it.each([false, true])(
    "announces the linked checkpoint mission, including retries (last: %s)",
    async (last) => {
      const { goal, user } = await signedInLearner();

      await prisma.subscription.create({
        data: { plan: "plus", referenceId: user.id, status: "active" },
      });

      const chapter = await libraryChapterFixture();

      const day = await studySessionFixture({
        goalId: goal.id,
        localDate: TODAY,
        missions: {
          picks: [
            { anchor: { blockKind: "checkpoint" }, kind: "challenge", total: 1 },
            ...(last ? [] : [{ anchor: {}, kind: "askBuddy", total: 1 }]),
          ],
          version: 1,
        },
        userId: user.id,
      });

      const block = await studySessionBlockFixture({ kind: "checkpoint", sessionId: day.id });

      const row = await prisma.languageConversation.create({
        data: {
          chapterId: chapter.id,
          goalId: goal.id,
          kind: "checkpoint",
          language: "en",
          level: "A2",
          minutes: 2,
          objectivesMet: [],
          scenario: RENTING_SCENARIO,
          startedAt: NOW,
          studyBlockId: block.id,
          targetLanguage: "es",
          titleSnapshot: "A checkpoint call",
          userId: user.id,
        },
      });

      await connectTestCall(row.id);

      const input = testCallCompletionInput(row.id, {
        spokenSeconds: 30,
        timeZone: TIME_ZONE,
        turns: [],
        usedHelp: false,
      });

      const completed = await completeLanguageConversation({ conversationId: row.id, input });

      expect(completed).toMatchObject({
        missionMoment: { completed: ["challenge"], fullMeal: { bonus: 50, paid: last } },
        status: "completed",
      });

      await expect(
        completeLanguageConversation({ conversationId: row.id, input }),
      ).resolves.toStrictEqual(completed);
    },
  );

  it.each([false, true])(
    "repairs linked mission attribution after its day expires (last: %s)",
    async (last) => {
      const { goal, user } = await signedInLearner();

      await prisma.subscription.create({
        data: { plan: "plus", referenceId: user.id, status: "active" },
      });

      const chapter = await libraryChapterFixture();

      const day = await studySessionFixture({
        goalId: goal.id,
        localDate: TODAY,
        missions: {
          picks: [
            { anchor: { blockKind: "checkpoint" }, kind: "challenge", total: 1 },
            ...(last ? [] : [{ anchor: {}, kind: "askBuddy", total: 1 }]),
          ],
          version: 1,
        },
        startedAt: NOW,
        userId: user.id,
      });

      const block = await studySessionBlockFixture({ kind: "checkpoint", sessionId: day.id });

      const row = await prisma.languageConversation.create({
        data: {
          chapterId: chapter.id,
          goalId: goal.id,
          kind: "checkpoint",
          language: "en",
          level: "A2",
          minutes: 2,
          objectivesMet: [],
          scenario: RENTING_SCENARIO,
          startedAt: NOW,
          studyBlockId: block.id,
          targetLanguage: "es",
          titleSnapshot: "A checkpoint to recover",
          userId: user.id,
        },
      });

      await connectTestCall(row.id);

      const input = testCallCompletionInput(row.id, {
        spokenSeconds: 30,
        timeZone: TIME_ZONE,
        turns: [],
        usedHelp: false,
      });

      await interruptMissionPayout({
        dayId: day.id,
        finish: () => completeLanguageConversation({ conversationId: row.id, input }),
        missionsOnly: true,
      });

      const before = await prisma.userProgress.findUniqueOrThrow({ where: { userId: user.id } });
      vi.setSystemTime(new Date(NOW.getTime() + MS_PER_DAY));

      await studySessionFixture({
        goalId: goal.id,
        localDate: new Date(TODAY.getTime() + MS_PER_DAY),
        missions: { picks: [], version: 1 },
        startedAt: new Date(),
        userId: user.id,
      });

      const completed = await completeLanguageConversation({ conversationId: row.id, input });

      expect(completed).toMatchObject({
        missionMoment: { completed: ["challenge"], fullMeal: { bonus: 50, paid: last } },
        status: "completed",
      });

      await expect(
        completeLanguageConversation({ conversationId: row.id, input }),
      ).resolves.toStrictEqual(completed);

      const after = await prisma.userProgress.findUniqueOrThrow({ where: { userId: user.id } });
      expect(after.totalBrainPower - before.totalBrainPower).toBe(last ? 50n : 0n);
    },
  );

  it("a checkpoint call never claims an unrelated challenge that was already done", async () => {
    const { goal, user } = await signedInLearner();

    await prisma.subscription.create({
      data: { plan: "plus", referenceId: user.id, status: "active" },
    });

    const chapter = await libraryChapterFixture();

    const day = await studySessionFixture({
      goalId: goal.id,
      localDate: TODAY,
      missions: {
        picks: [
          { anchor: { blockKind: "checkpoint" }, kind: "challenge", total: 1 },
          { anchor: {}, kind: "askBuddy", total: 1 },
        ],
        version: 1,
      },
      userId: user.id,
    });

    await studySessionBlockFixture({
      completedAt: new Date(NOW.getTime() - 60_000),
      kind: "checkpoint",
      position: 0,
      sessionId: day.id,
      status: "completed",
    });

    const linked = await studySessionBlockFixture({
      kind: "checkpoint",
      position: 1,
      sessionId: day.id,
    });

    const row = await prisma.languageConversation.create({
      data: {
        chapterId: chapter.id,
        goalId: goal.id,
        kind: "checkpoint",
        language: "en",
        level: "A2",
        minutes: 2,
        objectivesMet: [],
        scenario: RENTING_SCENARIO,
        startedAt: NOW,
        studyBlockId: linked.id,
        targetLanguage: "es",
        titleSnapshot: "A later checkpoint call",
        userId: user.id,
      },
    });

    await connectTestCall(row.id);

    const input = testCallCompletionInput(row.id, {
      spokenSeconds: 30,
      timeZone: TIME_ZONE,
      turns: [],
      usedHelp: false,
    });

    await expect(
      completeLanguageConversation({ conversationId: row.id, input }),
    ).resolves.toMatchObject({ missionMoment: null, status: "completed" });

    await expect(
      loadMissionMoment({
        source: { id: row.id, kind: "conversation" },
        timeZone: TIME_ZONE,
        userId: user.id,
      }),
    ).resolves.toBeNull();
  });

  it("pays the last call mission and repairs a completed call retry without reviewing it again", async () => {
    const { goal, user } = await signedInLearner();
    const chapter = await libraryChapterFixture();

    const day = await missionDay({
      anchor: { chapterId: chapter.id },
      goalId: goal.id,
      kind: "call",
      userId: user.id,
    });

    const row = await prisma.languageConversation.create({
      data: {
        chapterId: chapter.id,
        goalId: goal.id,
        kind: "practice",
        language: "en",
        level: "A2",
        minutes: 2,
        objectivesMet: ["Is it available?"],
        scenario: RENTING_SCENARIO,
        startedAt: NOW,
        targetLanguage: "es",
        titleSnapshot: "A practice call",
        userId: user.id,
      },
    });

    // The objectives were marked during the live call; no learner transcript needs an AI review.
    await connectTestCall(row.id);

    const input = testCallCompletionInput(row.id, {
      spokenSeconds: 30,
      timeZone: "UTC",
      turns: [],
      usedHelp: false,
    });

    await interruptMissionPayout({
      dayId: day.id,
      finish: () => completeLanguageConversation({ conversationId: row.id, input }),
    });

    await expect(
      prisma.languageConversation.findUniqueOrThrow({ where: { id: row.id } }),
    ).resolves.toMatchObject({ status: "completed" });

    await expect(
      prisma.userProgress.findUniqueOrThrow({ where: { userId: user.id } }),
    ).resolves.toMatchObject({ totalBrainPower: 10n });

    await expect(
      prisma.studySession.findUniqueOrThrow({ where: { id: day.id } }),
    ).resolves.toMatchObject({ fullMealAt: null });

    const completed = await completeLanguageConversation({ conversationId: row.id, input });

    // The call's end says it was the day's last mission, and that it paid the +50.
    expect(completed).toMatchObject({
      conversation: { result: { brainPower: 10 } },
      missionMoment: { completed: ["call"], fullMeal: { bonus: 50, paid: true } },
      status: "completed",
    });

    await expect(getLanguageConversation(row.id)).resolves.toMatchObject({
      conversation: { result: { brainPower: 10 } },
      status: "ready",
    });

    await expectMissionPaid({ dayId: day.id, userId: user.id });

    await expect(
      completeLanguageConversation({ conversationId: row.id, input }),
    ).resolves.toStrictEqual(completed);

    await expect(
      prisma.learningEvent.count({ where: { kind: "conversation", userId: user.id } }),
    ).resolves.toBe(1);

    await expect(
      prisma.studySession.count({ where: { fullMealAt: { not: null }, userId: user.id } }),
    ).resolves.toBe(1);
  });

  it("pays a buddy mission when the learner's question is stored, before any model generation", async () => {
    const { goal, user } = await signedInLearner();

    const [{ lesson }, day] = await Promise.all([
      playableLessonFixture(),
      missionDay({ goalId: goal.id, kind: "askBuddy", userId: user.id }),
    ]);

    const request = {
      input: {
        context: { kind: "lesson" as const },
        question: "How can I use this?",
        requestId: crypto.randomUUID(),
      },
      target: { kind: "lesson" as const, lessonId: lesson.id },
    };

    const created = await createLessonQuestion(request);

    expect(created).toMatchObject({
      missionMoment: { completed: ["askBuddy"], fullMeal: { bonus: 50, paid: true } },
      question: { status: "pending" },
      status: "created",
    });

    await expectMissionPaid({ dayId: day.id, userId: user.id });

    await expect(createLessonQuestion(request)).resolves.toStrictEqual(created);

    await expect(
      prisma.lessonQuestion.count({ where: { thread: { userId: user.id } } }),
    ).resolves.toBe(1);

    await expect(
      prisma.usageRecord.count({ where: { kind: "tutorMessage", userId: user.id } }),
    ).resolves.toBe(0);

    await expect(
      prisma.userProgress.findUniqueOrThrow({ where: { userId: user.id } }),
    ).resolves.toMatchObject({ totalBrainPower: 50n });
  });

  it("pays one buddy bonus across goals whose local dates differ at the same instant", async () => {
    const { goal, user } = await signedInLearner();

    await prisma.goal.update({ data: { timezone: "UTC" }, where: { id: goal.id } });

    const secondary = await goalFixture({ timezone: TIME_ZONE, userId: user.id });

    await Promise.all([
      missionDay({
        goalId: goal.id,
        kind: "askBuddy",
        localDate: new Date("2026-10-13T00:00:00.000Z"),
        userId: user.id,
      }),
      missionDay({ goalId: secondary.id, kind: "askBuddy", userId: user.id }),
    ]);

    const { lesson } = await playableLessonFixture();

    await expect(
      createLessonQuestion({
        input: {
          context: { kind: "lesson" },
          question: "How can I use this?",
          requestId: crypto.randomUUID(),
        },
        target: { kind: "lesson", lessonId: lesson.id },
      }),
    ).resolves.toMatchObject({
      // The question paid the bonus in one goal's day: its moment says so, whichever day it shows.
      missionMoment: { completed: ["askBuddy"], fullMeal: { bonus: 50, paid: true } },
      status: "created",
    });

    const [progress, days, buddy] = await Promise.all([
      prisma.userProgress.findUniqueOrThrow({ where: { userId: user.id } }),
      prisma.studySession.findMany({ orderBy: { localDate: "asc" }, where: { userId: user.id } }),
      getBuddyStatus({ timeZone: "UTC" }),
    ]);

    expect(progress.totalBrainPower).toBe(50n);
    expect(days).toHaveLength(2);
    expect(days.filter((day) => day.fullMealAt !== null)).toHaveLength(1);

    // Both goals' picks are done, each recording the question that completed it.
    const completedBy = { id: expect.any(String), kind: "buddyQuestion" };

    expect(days.map((day) => day.missions)).toStrictEqual([
      { picks: [{ anchor: {}, completedBy, done: 1, kind: "askBuddy", total: 1 }], version: 1 },
      { picks: [{ anchor: {}, completedBy, done: 1, kind: "askBuddy", total: 1 }], version: 1 },
    ]);

    expect(buddy).toMatchObject({
      buddy: {
        today: {
          fullMeal: { earned: true },
          missions: [{ done: 1, kind: "askBuddy", status: "done" }],
        },
      },
      status: "ready",
    });
  });

  it("finishes the linked session when its last block is a language challenge call", async () => {
    const { goal, user } = await signedInLearner();

    const [chapter, plan] = await Promise.all([
      libraryChapterFixture(),
      planFixture({ goalId: goal.id }),
    ]);

    const item = await planItemFixture({ kind: "boss", planId: plan.id });

    const day = await studySessionFixture({
      goalId: goal.id,
      localDate: TODAY,
      missions: {
        picks: [{ anchor: { planItemId: item.id }, kind: "challenge", total: 1 }],
        version: 1,
      },
      startedAt: NOW,
      status: "active",
      userId: user.id,
    });

    const block = await studySessionBlockFixture({
      kind: "checkpoint",
      payload: {
        checkpoint: { kind: "boss", mock: false, passMark: 75, phase: 0, timeLimitMinutes: 6 },
        planItemId: item.id,
      },
      sessionId: day.id,
      status: "active",
    });

    const call = await prisma.languageConversation.create({
      data: {
        chapterId: chapter.id,
        goalId: goal.id,
        kind: "checkpoint",
        language: "en",
        level: "A2",
        minutes: 6,
        objectivesMet: RENTING_SCENARIO.objectives.map((objective) => objective.label),
        scenario: RENTING_SCENARIO,
        startedAt: NOW,
        studyBlockId: block.id,
        targetLanguage: "es",
        titleSnapshot: "A challenge call",
        userId: user.id,
      },
    });

    await prisma.subscription.create({
      data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
    });

    await connectTestCall(call.id);

    const completed = await completeLanguageConversation({
      conversationId: call.id,
      input: testCallCompletionInput(call.id, {
        spokenSeconds: 45,
        timeZone: "UTC",
        turns: [],
        usedHelp: false,
      }),
    });

    expect(completed).toMatchObject({
      conversation: { result: { brainPower: 230 } },
      missionMoment: { completed: ["challenge"], fullMeal: { bonus: 50, paid: true } },
      status: "completed",
    });

    await expect(
      prisma.studySession.findUniqueOrThrow({ where: { id: day.id } }),
    ).resolves.toMatchObject({ fullMealAt: NOW, status: "completed" });

    await expect(
      prisma.userProgress.findUniqueOrThrow({ where: { userId: user.id } }),
    ).resolves.toMatchObject({ totalBrainPower: 280n });

    await expect(
      prisma.studySessionBlock.findUniqueOrThrow({ where: { id: block.id } }),
    ).resolves.toMatchObject({ status: "completed" });

    await expect(
      prisma.planItem.findUniqueOrThrow({ where: { id: item.id } }),
    ).resolves.toMatchObject({ status: "done" });
  });
});
