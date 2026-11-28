import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { attemptFixture, mistakeFixture } from "@zoonk/testing/fixtures/learner";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { freezeClock } from "../_test-utils/frozen-clock";
import { mockSession } from "../_test-utils/mock-session";
import { mistakeShowing, pickInMistake, shownOptionTexts } from "../_test-utils/shown-choice";
import { getMock } from "../exams/mocks/get-mock";
import { mockConditionsSchema } from "../exams/mocks/mock-contract";
import { gradeChoiceAnswer, parseChoiceItem } from "../learner/_utils/choice-items";
import { recordLearnerAnswer } from "../learner/record-learner-answer";
import { finishStudyBlock } from "../sessions/finish-study-block";
import { getStudySession } from "../sessions/get-study-session";
import { answerMistakePractice } from "./answer-mistake-practice";
import { finishMistakePractice } from "./finish-mistake-practice";
import { getMistakePractice } from "./get-mistake-practice";
import { getMistakeShowing } from "./mistake-item";

async function questions(userId: string) {
  const skill = await skillFixture();

  return Promise.all(
    [0, 1, 2, 3].map(async () => {
      const item = await itemFixture({ content: choiceItemContent(), skillId: skill.id });
      const mistake = await mistakeFixture({ itemId: item.id, skillId: skill.id, userId });
      return { item, mistake };
    }),
  );
}

/** A run whose question another tab already missed: the miss reorders the options it showed. */
async function staleTabRun(scope: "block" | "mock" | "notebook") {
  freezeClock();
  vi.setSystemTime(new Date("2026-11-12T13:00:00Z"));

  const [user, skill] = await Promise.all([userFixture(), skillFixture()]);
  const content = choiceItemContent();

  const extras = ["Fifth", "Sixth", "Seventh", "Eighth"].map((text) => ({
    isCorrect: false,
    misconception: null,
    reason: `${text} isn't it.`,
    text,
  }));

  const item = await itemFixture({
    content: { ...content, options: [...content.options, ...extras] },
    skillId: skill.id,
  });

  const mistake = await mistakeFixture({
    cause: "gap",
    createdAt: new Date("2026-11-11T12:00:00Z"),
    itemId: item.id,
    skillId: skill.id,
    userId: user.id,
  });

  const runs = {
    block: async () => ({
      blockId: await practiceBlock({ mistakeId: mistake.id, userId: user.id }),
    }),
    mock: async () => ({
      mockId: await finishedMock({ item, mistakeId: mistake.id, userId: user.id }),
    }),
    notebook: async () => ({}),
  };

  const run = await runs[scope]();

  mockSession(user.id);

  const layout = (missedAt: Date) =>
    shownOptionTexts({ blockId: getMistakeShowing({ id: mistake.id, missedAt }), item });

  const before = layout(mistake.missedAt);

  // The miss's time decides the next order, so miss at a time whose order moves the right answer.
  const missedAt = Array.from(
    { length: 60 },
    (_, minute) => new Date(Date.UTC(2026, 10, 12, 14, minute)),
  ).find((time) => layout(time).indexOf("Right answer") !== before.indexOf("Right answer"));

  if (!missedAt) {
    throw new Error("Expected a miss time that moves the right answer");
  }

  return { item, missedAt, mistake, run };
}

async function practiceBlock({ mistakeId, userId }: { mistakeId: string; userId: string }) {
  const session = await studySessionFixture({ startedAt: new Date(), status: "active", userId });

  const block = await studySessionBlockFixture({
    kind: "review",
    payload: { mistakeIds: [mistakeId] },
    sessionId: session.id,
    status: "pending",
  });

  return block.id;
}

async function finishedMock({
  item,
  mistakeId,
  userId,
}: {
  item: { id: string };
  mistakeId: string;
  userId: string;
}) {
  const mock = await prisma.mockExam.create({
    data: {
      conditions: {},
      finishedAt: new Date(),
      sectionStartedAt: new Date(),
      status: "finished",
      userId,
    },
  });

  const attempt = await attemptFixture({
    answer: { selectedIndex: 1 },
    answeredAt: new Date("2026-11-11T12:00:00Z"),
    isCorrect: false,
    itemId: item.id,
    mockExamId: mock.id,
    userId,
  });

  await prisma.mistake.update({ data: { attemptId: attempt.id }, where: { id: mistakeId } });
  return mock.id;
}

describe("Scoped mistake practice", () => {
  it("keeps the block's frozen order and completes once after the last playable question", async () => {
    const [user, other] = await Promise.all([userFixture(), userFixture()]);

    const [assigned, session] = await Promise.all([
      questions(user.id),
      studySessionFixture({ startedAt: new Date(), status: "active", userId: user.id }),
    ]);

    const [first, last, retired, outside] = assigned;

    const block = await studySessionBlockFixture({
      kind: "review",
      payload: { mistakeIds: [last!.mistake.id, retired!.mistake.id, first!.mistake.id] },
      sessionId: session.id,
      status: "pending",
    });

    await prisma.item.update({ data: { retiredAt: new Date() }, where: { id: retired!.item.id } });

    const input = { blockId: block.id, timeZone: "UTC" };
    const finish = { ...input, answerIds: [] };

    mockSession(other.id);
    await expect(getMistakePractice(input)).resolves.toStrictEqual({ status: "notFound" });
    await expect(finishMistakePractice(finish)).resolves.toStrictEqual({ status: "notFound" });

    mockSession(user.id);
    const result = await getMistakePractice(input);

    expect(
      result.status === "ready" && result.practice.map((entry) => entry.mistakeId),
    ).toStrictEqual([last!.mistake.id, first!.mistake.id]);

    const answer = async ({ item, mistake }: (typeof assigned)[number]) =>
      answerMistakePractice({
        input: {
          answer: await pickInMistake({ mistakeId: mistake.id }),
          attemptId: randomUUID(),
          durationMs: 4000,
          itemId: item.id,
          run: { answerIds: [], blockId: block.id },
          showing: await mistakeShowing(mistake.id),
          timeZone: "UTC",
        },
        mistakeId: mistake.id,
      });

    const blockRow = () => prisma.studySessionBlock.findUniqueOrThrow({ where: { id: block.id } });

    await expect(answer(outside!)).resolves.toStrictEqual({ status: "notFound" });
    await expect(answer(last!)).resolves.toMatchObject({ status: "ready" });
    await expect(blockRow()).resolves.toMatchObject({ completedAt: null, status: "pending" });

    await expect(
      finishStudyBlock({ blockId: block.id, input, sessionId: session.id }),
    ).resolves.toStrictEqual({ status: "unanswered" });

    await expect(getMistakePractice(input)).resolves.toMatchObject({
      practice: [{ mistakeId: first!.mistake.id }],
    });

    await expect(answer(first!)).resolves.toMatchObject({ status: "ready" });
    const finished = await blockRow();
    expect(finished).toMatchObject({ completedAt: expect.any(Date), status: "completed" });
    await expect(finishMistakePractice(finish)).resolves.toMatchObject({ status: "ready" });
    await expect(blockRow()).resolves.toStrictEqual(finished);

    await expect(
      prisma.attempt.count({ where: { studySessionId: null, userId: user.id } }),
    ).resolves.toBe(2);
  });

  it("keeps a block fixed from the notebook untouched until the empty completion POST", async () => {
    const user = await userFixture();
    const all = await questions(user.id);
    const assigned = all.slice(0, 2);

    const session = await studySessionFixture({
      startedAt: new Date(),
      status: "active",
      userId: user.id,
    });

    const block = await studySessionBlockFixture({
      kind: "practice",
      payload: { mistakeIds: assigned.map(({ mistake }) => mistake.id) },
      sessionId: session.id,
      status: "pending",
    });

    await prisma.mistake.updateMany({
      data: { missedAt: new Date(0) },
      where: { id: { in: assigned.map(({ mistake }) => mistake.id) } },
    });

    mockSession(user.id);

    const fix = async ({ item, mistake }: (typeof assigned)[number]) =>
      answerMistakePractice({
        input: {
          answer: await pickInMistake({ mistakeId: mistake.id }),
          durationMs: 4000,
          itemId: item.id,
          showing: await mistakeShowing(mistake.id),
          timeZone: "UTC",
        },
        mistakeId: mistake.id,
      });

    const input = { blockId: block.id, timeZone: "UTC" };
    const read = () => prisma.studySessionBlock.findUniqueOrThrow({ where: { id: block.id } });
    const day = () => getStudySession({ input, sessionId: session.id });

    await expect(fix(assigned[0]!)).resolves.toMatchObject({
      feedback: { fixed: true },
      status: "ready",
    });

    await expect(day()).resolves.toMatchObject({
      session: {
        blocks: [
          {
            estimatedMinutes: 1,
            id: block.id,
            questions: 1,
            screen: "mistakesPractice",
            status: "pending",
          },
        ],
      },
      status: "ready",
    });

    await expect(read()).resolves.toStrictEqual(block);

    await expect(fix(assigned[1]!)).resolves.toMatchObject({
      feedback: { fixed: true },
      status: "ready",
    });

    await expect(day()).resolves.toMatchObject({
      session: {
        blocks: [
          {
            estimatedMinutes: 0,
            id: block.id,
            questions: 0,
            screen: "mistakesPractice",
            status: "pending",
          },
        ],
      },
      status: "ready",
    });

    await expect(getMistakePractice(input)).resolves.toMatchObject({
      practice: [],
      status: "ready",
    });

    await expect(read()).resolves.toStrictEqual(block);

    await expect(
      finishMistakePractice({ ...input, answerIds: [], ended: true }),
    ).resolves.toMatchObject({ result: { hasMorePractice: false, total: 0 }, status: "ready" });

    await expect(read()).resolves.toMatchObject({
      completedAt: expect.any(Date),
      status: "completed",
    });
  });

  it("includes a finished mock miss that reused an older notebook entry", async () => {
    const user = await userFixture();

    const [skill, goal, otherGoal] = await Promise.all([
      skillFixture(),
      goalFixture({ userId: user.id }),
      goalFixture({ userId: user.id }),
    ]);

    const mock = await prisma.mockExam.create({
      data: {
        conditions: mockConditionsSchema.parse({
          day: null,
          examQuestions: null,
          fullLength: true,
          partialCredit: "allOrNothing",
          purpose: "practice",
          reused: 0,
          scoring: "raw",
          sections: [],
          shape: null,
          startTime: null,
          timeZone: "UTC",
          timedOutSections: [],
          wrongPenalty: 0,
        }),
        finishedAt: new Date(),
        goalId: goal.id,
        sectionStartedAt: new Date(),
        status: "finished",
        userId: user.id,
      },
    });

    const row = await itemFixture({ content: choiceItemContent(), skillId: skill.id });
    const item = parseChoiceItem(row);

    if (!item) {
      throw new Error("The mock question must be playable");
    }

    const answer = { selectedIndex: 1 };
    const grade = gradeChoiceAnswer({ answer, item });

    const miss = {
      answer,
      graded: { durationMs: 4000, isCorrect: false },
      itemId: item.id,
      language: "en",
      mistake: { questionText: grade.snapshot.question, snapshot: grade.snapshot },
      purpose: "learning" as const,
      skillId: skill.id,
      timeZone: "UTC",
      userId: user.id,
    };

    const earlier = await recordLearnerAnswer(miss);

    await Promise.all([
      prisma.mistake.update({ data: { cause: "gap" }, where: { id: earlier.mistake!.id } }),
      attemptFixture({ isCorrect: true, itemId: item.id, skillId: skill.id, userId: user.id }),
      attemptFixture({ isCorrect: true, itemId: item.id, skillId: skill.id, userId: user.id }),
    ]);

    const later = await recordLearnerAnswer({ ...miss, mockExamId: mock.id });
    expect(later.attempt.cause).toBe("gap");
    expect(later.mistake?.id).toBe(earlier.mistake?.id);

    mockSession(user.id);
    const scoped = await getMistakePractice({ goalId: otherGoal.id, mockId: mock.id });

    expect(
      scoped.status === "ready" && scoped.practice.map((entry) => entry.mistakeId),
    ).toStrictEqual([earlier.mistake?.id]);

    await expect(getMock(mock.id)).resolves.toMatchObject({
      mock: { practiceAvailable: true },
      status: "ready",
    });

    await prisma.mistake.update({
      data: { missedAt: new Date(0) },
      where: { id: earlier.mistake!.id },
    });

    const answered = await answerMistakePractice({
      input: {
        answer: await pickInMistake({ mistakeId: earlier.mistake!.id }),
        durationMs: 4000,
        itemId: item.id,
        run: { answerIds: [], mockId: mock.id },
        showing: await mistakeShowing(earlier.mistake!.id),
        timeZone: "UTC",
      },
      mistakeId: earlier.mistake!.id,
    });

    if (answered.status !== "ready") {
      throw new Error(answered.status);
    }

    expect(answered.feedback.fixed).toBe(true);

    await expect(
      finishMistakePractice({
        answerIds: [answered.feedback.answerId],
        ended: true,
        mockId: mock.id,
        timeZone: "UTC",
      }),
    ).resolves.toMatchObject({ result: { hasMorePractice: false, total: 1 }, status: "ready" });

    await expect(
      prisma.learningEvent.findFirst({ where: { lessonKind: "mistakePractice", userId: user.id } }),
    ).resolves.toMatchObject({ goalId: goal.id });

    await expect(getMock(mock.id)).resolves.toMatchObject({
      mock: { practiceAvailable: false },
      status: "ready",
    });
  });

  it.each([false, true])(
    "offers another batch only for earlier misses (earlier: %s)",
    async (earlier) => {
      const user = await userFixture();
      const [first, next] = await questions(user.id);

      await prisma.mistake.update({
        data: { missedAt: new Date(0) },
        where: { id: first!.mistake.id },
      });

      if (earlier) {
        await prisma.mistake.update({
          data: { missedAt: new Date(0) },
          where: { id: next!.mistake.id },
        });
      }

      mockSession(user.id);

      const answered = await answerMistakePractice({
        input: {
          answer: await pickInMistake({ mistakeId: first!.mistake.id }),
          durationMs: 4000,
          itemId: first!.item.id,
          showing: await mistakeShowing(first!.mistake.id),
          timeZone: "UTC",
        },
        mistakeId: first!.mistake.id,
      });

      if (answered.status !== "ready") {
        throw new Error(answered.status);
      }

      await expect(
        finishMistakePractice({
          answerIds: [answered.feedback.answerId],
          ended: true,
          skillId: next!.mistake.skillId ?? undefined,
          timeZone: "UTC",
        }),
      ).resolves.toMatchObject({ result: { hasMorePractice: earlier }, status: "ready" });
    },
  );

  it("returns only an owned finished mock's mistakes, including today's", async () => {
    const [user, other] = await Promise.all([userFixture(), userFixture()]);

    const [assigned, mock] = await Promise.all([
      questions(user.id),
      prisma.mockExam.create({
        data: { conditions: {}, sectionStartedAt: new Date(), userId: user.id },
      }),
    ]);

    const [miss] = assigned;

    const attempt = await attemptFixture({
      answer: { selectedIndex: 1 },
      isCorrect: false,
      itemId: miss!.item.id,
      mockExamId: mock.id,
      userId: user.id,
    });

    await prisma.mistake.update({
      data: { attemptId: attempt.id },
      where: { id: miss!.mistake.id },
    });

    mockSession(user.id);

    await expect(getMistakePractice({ mockId: mock.id })).resolves.toStrictEqual({
      status: "notFound",
    });

    const notebook = await getMistakePractice({});

    expect(
      notebook.status === "ready" && notebook.practice.map((entry) => entry.mistakeId),
    ).not.toContain(miss!.mistake.id);

    await prisma.mockExam.update({
      data: { finishedAt: new Date(), status: "finished" },
      where: { id: mock.id },
    });

    const scoped = await getMistakePractice({ mockId: mock.id });

    expect(
      scoped.status === "ready" && scoped.practice.map((entry) => entry.mistakeId),
    ).toStrictEqual([miss!.mistake.id]);

    mockSession(other.id);

    await expect(getMistakePractice({ mockId: mock.id })).resolves.toStrictEqual({
      status: "notFound",
    });
  });

  it.each(["notebook", "block", "mock"] as const)(
    "grades each tab of a %s run in the order that tab showed",
    async (scope) => {
      const { item, missedAt, mistake, run } = await staleTabRun(scope);
      const practice = await getMistakePractice({ ...run, timeZone: "UTC" });

      if (practice.status !== "ready" || !practice.practice[0]) {
        throw new Error(`The ${scope} run didn't load its mistake`);
      }

      const [{ questions: shown, showing }] = practice.practice;
      const options = shown[0]?.options ?? [];
      const pick = (text: string) => ({ selectedIndex: options.indexOf(text) });

      const send = (answer: { selectedIndex: number }, attemptId: string, sent = showing) =>
        answerMistakePractice({
          input: {
            answer,
            attemptId,
            durationMs: 4000,
            itemId: item.id,
            run: { ...run, answerIds: [] },
            showing: sent,
            timeZone: "UTC",
          },
          mistakeId: mistake.id,
        });

      const firstTab = randomUUID();
      vi.setSystemTime(missedAt);

      const missed = await send(pick("Wrong answer"), firstTab);
      expect(missed).toMatchObject({ feedback: { isCorrect: false }, status: "ready" });

      const moved = await mistakeShowing(mistake.id);
      expect(moved).not.toBe(showing);

      await expect(send(pick("Right answer"), randomUUID())).resolves.toMatchObject({
        feedback: { correctAnswer: pick("Right answer"), isCorrect: true },
        status: "ready",
      });

      await expect(send(pick("Right answer"), firstTab, moved)).resolves.toStrictEqual(missed);

      await expect(
        send(
          pick("Right answer"),
          randomUUID(),
          getMistakeShowing({ ...mistake, id: randomUUID() }),
        ),
      ).resolves.toStrictEqual({ status: "invalidItem" });
    },
  );

  it("grades a day's replay in its own option order and fixes the notebook entry it missed", async () => {
    freezeClock();
    vi.setSystemTime(new Date("2026-11-11T12:00:00Z"));

    const [user, skill] = await Promise.all([userFixture(), skillFixture()]);
    const content = choiceItemContent();

    const extras = ["Fifth", "Sixth", "Seventh", "Eighth"].map((text) => ({
      isCorrect: false,
      misconception: null,
      reason: `${text} isn't it.`,
      text,
    }));

    const row = await itemFixture({
      content: { ...content, options: [...content.options, ...extras] },
      skillId: skill.id,
    });

    const item = parseChoiceItem(row);

    if (item?.format !== "multipleChoice") {
      throw new Error("The missed question must be a playable multiple-choice question");
    }

    const stored = item.content.options.map((option) => option.text);
    const wrongAtFirst = { selectedIndex: stored.indexOf("Wrong answer") };
    const graded = gradeChoiceAnswer({ answer: wrongAtFirst, item });

    const { mistake } = await recordLearnerAnswer({
      answer: wrongAtFirst,
      graded: { durationMs: 4000, isCorrect: false },
      itemId: item.id,
      language: "en",
      mistake: { questionText: graded.snapshot.question, snapshot: graded.snapshot },
      purpose: "learning",
      skillId: skill.id,
      timeZone: "UTC",
      userId: user.id,
    });

    if (!mistake) {
      throw new Error("The miss must open a notebook entry");
    }

    vi.setSystemTime(new Date("2026-11-12T12:00:00Z"));

    const session = await studySessionFixture({
      startedAt: new Date(),
      status: "active",
      userId: user.id,
    });

    const block = await studySessionBlockFixture({
      kind: "review",
      payload: { mistakeIds: [mistake.id] },
      sessionId: session.id,
      status: "pending",
    });

    mockSession(user.id);
    const practice = await getMistakePractice({ blockId: block.id, timeZone: "UTC" });
    const shown = practice.status === "ready" ? practice.practice[0]?.questions[0]?.options : [];

    expect(shown).not.toStrictEqual(stored);
    expect(shown?.toSorted()).toStrictEqual(stored.toSorted());

    const input = {
      answer: { selectedIndex: shown?.indexOf("Right answer") ?? -1 },
      attemptId: randomUUID(),
      durationMs: 4000,
      itemId: item.id,
      run: { answerIds: [], blockId: block.id },
      showing: await mistakeShowing(mistake.id),
      timeZone: "UTC",
    };

    const first = await answerMistakePractice({ input, mistakeId: mistake.id });

    expect(first).toMatchObject({
      feedback: { fixed: true, fixedMistakeIds: [mistake.id], isCorrect: true },
      status: "ready",
    });

    await expect(
      answerMistakePractice({
        input: {
          ...input,
          answer: { selectedIndex: shown?.indexOf("Wrong answer") ?? -1 },
          showing: await mistakeShowing(mistake.id),
        },
        mistakeId: mistake.id,
      }),
    ).resolves.toStrictEqual(first);

    const [entries, played] = await Promise.all([
      prisma.mistake.findMany({ where: { userId: user.id } }),
      prisma.studySessionBlock.findUniqueOrThrow({ where: { id: block.id } }),
    ]);

    expect(entries).toMatchObject([{ id: mistake.id, status: "fixed" }]);
    expect(played.status).toBe("completed");
  });
});
