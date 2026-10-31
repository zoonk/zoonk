import { generateExamSpeakingCard } from "@zoonk/ai/tasks/language/exam-speaking-card";
import { gateMemoryFact } from "@zoonk/ai/tasks/memory/gate";
import { classifyMistakeCause } from "@zoonk/ai/tasks/mistakes/cause";
import { mockConditionsSchema } from "@zoonk/core/exams/mocks/contract";
import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { mistakeFixture } from "@zoonk/testing/fixtures/learner";
import { memoryFactFixture } from "@zoonk/testing/fixtures/memory";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { start } from "workflow/api";
import { followUpsWorkflow } from "./follow-ups-workflow";

vi.mock("@zoonk/ai/tasks/mistakes/cause", () => ({ classifyMistakeCause: vi.fn() }));
vi.mock("@zoonk/ai/tasks/memory/gate", () => ({ gateMemoryFact: vi.fn() }));

vi.mock("@zoonk/ai/tasks/language/exam-speaking-card", () => ({
  generateExamSpeakingCard: vi.fn(),
}));

const WAIT = { interval: 200, timeout: 30_000 };

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

function readCause(mistakeId: string) {
  return prisma.mistake.findUniqueOrThrow({ where: { id: mistakeId } }).then((row) => row.cause);
}

function countOwed(userId: string) {
  return prisma.followUp.count({ where: { userId } });
}

async function runFollowUps(userId: string) {
  const run = await start(followUpsWorkflow, [{ userId }]);
  return run.returnValue;
}

describe(followUpsWorkflow, () => {
  beforeEach(() => {
    vi.mocked(classifyMistakeCause).mockReset().mockResolvedValue(classified());

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

    await expect(runFollowUps(userId)).resolves.toStrictEqual({ status: "done" });
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

  it("retries a failed model call in its step until the work is done", async () => {
    const { mistakeId, userId } = await owedCause();
    vi.mocked(classifyMistakeCause).mockRejectedValueOnce(new Error("The model is busy"));

    await runFollowUps(userId);

    await vi.waitFor(async () => {
      await expect(readCause(mistakeId)).resolves.toBe("trap");
    }, WAIT);

    expect(classifyMistakeCause).toHaveBeenCalledTimes(2);
  });

  it("runs a learner's rows once when two runs start together", async () => {
    const { mistakeId, userId } = await owedCause();

    const results = await Promise.all([runFollowUps(userId), runFollowUps(userId)]);

    expect(results).toContainEqual({ status: "done" });

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

      await start(followUpsWorkflow, [{ userId }]);
      return classified();
    });

    await runFollowUps(userId);

    await vi.waitFor(async () => {
      await expect(readCause(later.id)).resolves.toBe("trap");
      await expect(countOwed(userId)).resolves.toBe(0);
    }, WAIT);
  });

  it("leaves a stopped run's rows to the next one", async () => {
    const { mistakeId, userId } = await owedCause();

    const stopped = await start(followUpsWorkflow, [{ userId }]);
    await stopped.cancel();

    await runFollowUps(userId);

    await vi.waitFor(async () => {
      await expect(readCause(mistakeId)).resolves.toBe("trap");
      await expect(countOwed(userId)).resolves.toBe(0);
    }, WAIT);
  });
});
