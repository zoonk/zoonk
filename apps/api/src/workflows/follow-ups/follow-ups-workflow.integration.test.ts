import { waitForSleep } from "@workflow/vitest";
import { generateExamSpeakingCard } from "@zoonk/ai/tasks/language/exam-speaking-card";
import { findMistakePattern } from "@zoonk/ai/tasks/language/mistake-pattern";
import { gateMemoryFact } from "@zoonk/ai/tasks/memory/gate";
import { classifyMistakeCause } from "@zoonk/ai/tasks/mistakes/cause";
import { mockConditionsSchema } from "@zoonk/core/exams/mocks/contract";
import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { mistakeFixture } from "@zoonk/testing/fixtures/learner";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { libraryStepFixture } from "@zoonk/testing/fixtures/library-steps";
import { memoryFactFixture } from "@zoonk/testing/fixtures/memory";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";
import { getHookByToken, getRun } from "workflow/api";
import { getWorld } from "workflow/runtime";
import { startOnce } from "../_shared/run-token";
import { followUpsWorkflow, getFollowUpsToken } from "./follow-ups-workflow";

vi.mock("@zoonk/ai/tasks/mistakes/cause", () => ({ classifyMistakeCause: vi.fn() }));
vi.mock("@zoonk/ai/tasks/memory/gate", () => ({ gateMemoryFact: vi.fn() }));

vi.mock("@zoonk/ai/tasks/language/exam-speaking-card", () => ({
  generateExamSpeakingCard: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/language/mistake-pattern", () => ({ findMistakePattern: vi.fn() }));

const WAIT = { interval: 200, timeout: 10_000 };

const CAUSE = {
  correctAnswer: "since",
  language: "en",
  learnerAnswer: "for",
  misconception: "",
  question: "I've lived here ___ 2020.",
  recentAccuracy: "3 of 5 right",
};

function classified() {
  return {
    data: { cause: "trap" as const },
    provenance: {} as never,
    systemPrompt: "",
    usage: {} as never,
    userPrompt: "",
  };
}

async function owedCause() {
  const user = await userFixture();
  const mistake = await mistakeFixture({ cause: null, userId: user.id });

  await prisma.followUp.create({
    data: {
      input: { cause: CAUSE, mistakeId: mistake.id },
      key: mistake.id,
      kind: "classifyMistakeCause",
      userId: user.id,
    },
  });

  return { mistakeId: mistake.id, userId: user.id };
}

function noPattern() {
  return {
    data: {
      contrast: [],
      drill: [],
      kind: "none" as const,
      mistakeNumbers: [],
      rule: "",
      title: "",
    },
    provenance: {} as never,
    systemPrompt: "",
    usage: {} as never,
    userPrompt: "",
  };
}

async function addMistakes({
  from,
  lessonId,
  userId,
}: {
  from: number;
  lessonId: string;
  userId: string;
}) {
  const steps = await Promise.all(
    [from, from + 1, from + 2].map((position) =>
      libraryStepFixture({ kind: "typedAnswer", lessonId, position }),
    ),
  );

  await Promise.all(steps.map((step) => mistakeFixture({ stepId: step.id, userId })));
}

function owePatternCheck(userId: string) {
  return prisma.followUp.create({
    data: { input: { language: "en" }, key: "en", kind: "findMistakePattern", userId },
  });
}

async function findRunBehind({ holderId, since }: { holderId: string; since: Date }) {
  const world = await getWorld();
  const workflowName = await getRun(holderId).workflowName;
  const { data } = await world.runs.list({ workflowName });
  const behind = data.find((run) => run.runId !== holderId && run.createdAt >= since);

  if (!behind) {
    throw new Error(`No run started behind ${holderId}`);
  }

  return getRun(behind.runId);
}

function readCause(mistakeId: string) {
  return prisma.mistake.findUniqueOrThrow({ where: { id: mistakeId } }).then((row) => row.cause);
}

function countOwed(userId: string) {
  return prisma.followUp.count({ where: { userId } });
}

function startFollowUps(userId: string) {
  return startOnce(followUpsWorkflow, [{ userId }], getFollowUpsToken(userId));
}

async function runFollowUps(userId: string) {
  await getRun(await startFollowUps(userId)).returnValue;
}

describe(followUpsWorkflow, () => {
  beforeEach(() => {
    vi.mocked(classifyMistakeCause).mockReset().mockResolvedValue(classified());
    vi.mocked(findMistakePattern).mockReset().mockResolvedValue(noPattern());

    vi.mocked(gateMemoryFact)
      .mockReset()
      .mockResolvedValue({ decision: "keep", sensitive: true } as Awaited<
        ReturnType<typeof gateMemoryFact>
      >);
  });

  it("runs each owed work in its own run and ends its row", async () => {
    const { mistakeId, userId } = await owedCause();
    const fact = await memoryFactFixture({ statement: "Has diabetes", userId });

    await prisma.followUp.create({
      data: {
        input: { factId: fact.id, statement: fact.statement },
        key: `${fact.id}:wording`,
        kind: "checkFactSensitivity",
        userId,
      },
    });

    await runFollowUps(userId);
    await expect(countOwed(userId)).resolves.toBe(0);

    await vi.waitFor(async () => {
      await expect(readCause(mistakeId)).resolves.toBe("trap");

      await expect(
        prisma.memoryFact.findUniqueOrThrow({ where: { id: fact.id } }),
      ).resolves.toMatchObject({ sensitive: true });
    }, WAIT);
  });

  it("writes the speaking paper a mock's start owed while the earlier papers are sat", async () => {
    const user = await userFixture();

    const goal = await goalFixture({
      details: { examName: "DELE" },
      kind: "exam",
      language: "pt",
      targetLanguage: "es",
      title: "DELE B2",
      userId: user.id,
    });

    vi.mocked(generateExamSpeakingCard).mockResolvedValue({
      data: {
        character: { name: "Lucía", place: "Sala de examen", role: "examinadora" },
        characterBrief: "Give the instruction, listen, then ask a question.",
        hints: [],
        instructions: ["Hable sobre el tema."],
        openingLine: "Buenos días.",
        photos: [],
        prompts: [],
        summary: "Fale sobre o tema.",
        table: null,
        text: null,
      },
      provenance: {} as never,
      systemPrompt: "",
      usage: {} as never,
      userPrompt: "",
    });

    const reading = { essays: [], itemIds: [], minutes: 30, name: "Lectura", questions: 0 };
    const speaking = { ...reading, kind: "speaking", minutes: 20, name: "Expresión oral" };

    const mock = await prisma.mockExam.create({
      data: {
        conditions: {
          day: null,
          examQuestions: null,
          fullLength: true,
          partialCredit: "allOrNothing",
          purpose: "practice",
          reused: 0,
          scoring: "raw",
          sections: [
            { ...reading, routing: null },
            { ...speaking, routing: null },
          ],
          shape: null,
          startTime: null,
          timeZone: null,
          timedOutSections: [],
          wrongPenalty: 0,
        },
        goalId: goal.id,
        sectionStartedAt: new Date(),
        startedAt: new Date(),
        userId: user.id,
      },
    });

    await prisma.followUp.create({
      data: {
        input: { mockId: mock.id },
        key: mock.id,
        kind: "writeSpeakingPaper",
        userId: user.id,
      },
    });

    await runFollowUps(user.id);

    await vi.waitFor(async () => {
      const sitting = await prisma.mockExam.findUniqueOrThrow({ where: { id: mock.id } });
      const [, paper] = mockConditionsSchema.parse(sitting.conditions).sections;

      expect(paper?.speakingSectionId).toStrictEqual(expect.any(String));
    }, WAIT);

    await expect(countOwed(user.id)).resolves.toBe(0);
  });

  it("completes the day a finished block left unsettled", async () => {
    const user = await userFixture();
    const goal = await goalFixture({ timezone: "UTC", userId: user.id });

    const session = await studySessionFixture({
      goalId: goal.id,
      startedAt: new Date(),
      status: "active",
      userId: user.id,
    });

    const block = await studySessionBlockFixture({
      completedAt: new Date(),
      kind: "practice",
      sessionId: session.id,
      status: "completed",
    });

    await prisma.followUp.create({
      data: {
        input: { blockId: block.id, sessionId: session.id, timeZone: "UTC" },
        key: block.id,
        kind: "settleSessionDay",
        userId: user.id,
      },
    });

    await runFollowUps(user.id);

    await vi.waitFor(async () => {
      await expect(
        prisma.studySession.findUniqueOrThrow({ where: { id: session.id } }),
      ).resolves.toMatchObject({ endedAt: expect.any(Date), status: "completed" });
    }, WAIT);
  });

  it("retries a failed model call in its step until the work is done", async () => {
    const { mistakeId, userId } = await owedCause();
    vi.mocked(classifyMistakeCause).mockRejectedValueOnce(new Error("The model is busy"));

    await runFollowUps(userId);

    await vi.waitFor(async () => {
      await expect(readCause(mistakeId)).resolves.toBe("trap");
    }, WAIT);

    expect(classifyMistakeCause).toHaveBeenCalledTimes(2);
  });

  it("starts one run for a learner however many ask together, and runs their rows once", async () => {
    const { mistakeId, userId } = await owedCause();

    // A run gives up its token once it ends its rows, and a start decided after that rightly starts
    // a new run, so the row stays locked until every ask is answered.
    const runIds = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM follow_ups WHERE user_id = ${userId}::uuid FOR UPDATE`;
      return Promise.all([startFollowUps(userId), startFollowUps(userId)]);
    });

    expect(new Set(runIds).size).toBe(1);
    await getRun(runIds[0] ?? "").returnValue;

    await vi.waitFor(async () => {
      await expect(readCause(mistakeId)).resolves.toBe("trap");
    }, WAIT);

    expect(classifyMistakeCause).toHaveBeenCalledOnce();
    await expect(countOwed(userId)).resolves.toBe(0);
  });

  it("runs again work asked for while its run was going, and work that arrived as it ended", async () => {
    const { mistakeId, userId } = await owedCause();
    const later = await mistakeFixture({ cause: null, userId });

    // The learner's next write owes the same work again and asks for a run, as `oweFollowUps` does.
    vi.mocked(classifyMistakeCause).mockImplementationOnce(async () => {
      await prisma.followUp.createMany({
        data: [
          {
            input: { cause: CAUSE, mistakeId },
            key: mistakeId,
            kind: "classifyMistakeCause",
            userId,
          },
          {
            input: { cause: CAUSE, mistakeId: later.id },
            key: later.id,
            kind: "classifyMistakeCause",
            userId,
          },
        ],
        skipDuplicates: true,
      });

      await prisma.followUp.updateMany({
        data: { revision: { increment: 1 } },
        where: { key: mistakeId, userId },
      });

      await startFollowUps(userId);
      return classified();
    });

    await runFollowUps(userId);

    await vi.waitFor(async () => {
      await expect(readCause(later.id)).resolves.toBe("trap");
      await expect(countOwed(userId)).resolves.toBe(0);
    }, WAIT);
  });

  it("checks again, once the running check ends, mistakes made after it read them", async () => {
    const user = await userFixture();
    const lesson = await libraryLessonFixture({ targetLanguage: "en" });
    const firstCheck = Promise.withResolvers<null>();
    const checked: number[] = [];

    vi.mocked(findMistakePattern).mockImplementation(async ({ mistakes }) => {
      checked.push(mistakes.length);

      if (checked.length === 1) {
        await firstCheck.promise;
      }

      return noPattern();
    });

    await addMistakes({ from: 0, lessonId: lesson.id, userId: user.id });
    await owePatternCheck(user.id);
    await runFollowUps(user.id);
    await vi.waitFor(() => expect(checked).toStrictEqual([3]), WAIT);

    const holder = await getHookByToken(`findMistakePattern:${user.id}:en`);
    const askedAgainAt = new Date();

    await addMistakes({ from: 3, lessonId: lesson.id, userId: user.id });
    await owePatternCheck(user.id);
    await runFollowUps(user.id);

    // A run waiting its turn looks again every 10 s, so the test wakes it once the turn is free.
    const waiting = await findRunBehind({ holderId: holder.runId, since: askedAgainAt });
    const sleepId = await waitForSleep(waiting);

    firstCheck.resolve(null);
    await getRun(holder.runId).returnValue;
    await waiting.wakeUp({ correlationIds: [sleepId] });

    await vi.waitFor(() => expect(checked).toStrictEqual([3, 6]), WAIT);
    await expect(countOwed(user.id)).resolves.toBe(0);
  });

  it("starts one check for an ask when the queue takes its run but the answer is lost", async () => {
    const user = await userFixture();
    const lesson = await libraryLessonFixture({ targetLanguage: "en" });
    const world = await getWorld();
    const queue = world.queue.bind(world);
    const queued = new Set<string>();

    const enqueue = vi.spyOn(world, "queue").mockImplementation(async (...args) => {
      const result = await queue(...args);
      const [, message] = args;

      if (
        "runInput" in message &&
        message.runInput?.workflowName.endsWith("//backgroundTaskWorkflow")
      ) {
        const isFirst = queued.size === 0;
        queued.add(message.runId);

        if (isFirst) {
          throw new Error("The queue took the run, but its answer was lost");
        }
      }

      return result;
    });

    onTestFinished(() => enqueue.mockRestore());

    await addMistakes({ from: 0, lessonId: lesson.id, userId: user.id });
    await owePatternCheck(user.id);
    await runFollowUps(user.id);

    expect(queued.size).toBe(1);
    await vi.waitFor(() => expect(findMistakePattern).toHaveBeenCalledOnce(), WAIT);
    await expect(countOwed(user.id)).resolves.toBe(0);
  });

  it("leaves a stopped run's rows to the next one", async () => {
    const { mistakeId, userId } = await owedCause();

    await getRun(await startFollowUps(userId)).cancel();

    await runFollowUps(userId);

    await vi.waitFor(async () => {
      await expect(readCause(mistakeId)).resolves.toBe("trap");
      await expect(countOwed(userId)).resolves.toBe(0);
    }, WAIT);
  });
});
