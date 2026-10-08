import { randomUUID } from "node:crypto";
import { generateExampleLines } from "@zoonk/ai/tasks/v2/variants/example-lines";
import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { libraryStepFixture } from "@zoonk/testing/fixtures/library-steps";
import { memoryFactFixture } from "@zoonk/testing/fixtures/memory";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { GUEST_OUT_OF_HELP, useGuestOutOfHelp } from "../../_test-utils/guest-out-of-help";
import { mockSession } from "../../_test-utils/mock-session";
import { getStepExampleLine } from "./get-step-example-line";

vi.mock("../../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

/** The model call is the external boundary; memory reads and the stored lines run for real. */
vi.mock("@zoonk/ai/tasks/v2/variants/example-lines", () => ({ generateExampleLines: vi.fn() }));

const slotContent = {
  exampleLineSlot: { idea: "A discount on something the learner buys." },
  text: "A 25% discount takes a quarter off the price.",
  title: "Discounts",
};

const interestContent = {
  exampleLineSlot: { idea: "Interest on an installment plan the learner pays." },
  text: "Paying in installments with interest costs more than the price: 10 payments of R$ 110 for R$ 1.000 add R$ 100.",
  title: "Interest",
};

const discountScreen = { idea: slotContent.exampleLineSlot.idea, text: slotContent.text };
const interestScreen = { idea: interestContent.exampleLineSlot.idea, text: interestContent.text };

/** The model's lines for the screens it's handed, in their order. */
function mockLines(lines: (string | null)[]) {
  vi.mocked(generateExampleLines).mockResolvedValueOnce({
    data: { lines },
    provenance: {
      generatedAt: new Date().toISOString(),
      latencyMs: 1,
      model: "openai/gpt-6-luna",
      promptVersion: "test",
      provider: "test",
      requestedModel: "openai/gpt-6-luna",
      runId: randomUUID(),
      usage: {},
    },
    systemPrompt: "",
    usage: {} as never,
    userPrompt: "",
  });
}

async function createExplanation(content: object = slotContent) {
  const lesson = await libraryLessonFixture({ contentStatus: "completed", language: "pt" });
  return libraryStepFixture({ content, lessonId: lesson.id });
}

/** A lesson with a check, a discount screen with a slot, one without and an interest screen with one. */
async function createTwoSlotLesson() {
  const lesson = await libraryLessonFixture({ contentStatus: "completed", language: "pt" });

  const [check, discount, plain, interest] = await Promise.all([
    libraryStepFixture({ content: slotContent, kind: "check", lessonId: lesson.id, position: 0 }),
    libraryStepFixture({ content: slotContent, lessonId: lesson.id, position: 1 }),
    libraryStepFixture({ content: { text: "A plain idea." }, lessonId: lesson.id, position: 2 }),
    libraryStepFixture({ content: interestContent, lessonId: lesson.id, position: 3 }),
  ]);

  return { check, discount, interest, lesson, plain };
}

/** An adult, since minors' and unknown ages' memory keeps no background or preferences. */
async function createLearner() {
  const learner = await userFixture();
  await learningProfileFixture({ birthMonth: 5, birthYear: 1990, userId: learner.id });
  mockSession(learner.id);
  return learner;
}

function shareFact(userId: string, statement = "Works at a pharmacy") {
  return memoryFactFixture({ category: "background", statement, userId });
}

describe(getStepExampleLine, () => {
  it("requires a session and a visible explanation screen", async () => {
    mockSession(null);

    await expect(getStepExampleLine({ stepId: randomUUID() })).resolves.toStrictEqual({
      status: "unauthorized",
    });

    await createLearner();
    const lesson = await libraryLessonFixture();
    const check = await libraryStepFixture({ kind: "check", lessonId: lesson.id });

    await expect(getStepExampleLine({ stepId: check.id })).resolves.toStrictEqual({
      status: "notFound",
    });
  });

  it("has no line, and runs no model, without a slot or anything the learner shared", async () => {
    const learner = await createLearner();

    const [noSlot, withSlot] = await Promise.all([
      createExplanation({ text: "A plain idea." }),
      createExplanation(),
    ]);

    await shareFact(learner.id);

    await expect(getStepExampleLine({ stepId: noSlot.id })).resolves.toStrictEqual({
      line: null,
      status: "ready",
    });

    const stranger = await userFixture();
    mockSession(stranger.id);

    await expect(getStepExampleLine({ stepId: withSlot.id })).resolves.toStrictEqual({
      line: null,
      status: "ready",
    });

    expect(generateExampleLines).not.toHaveBeenCalled();
  });

  it("asks a guest who used today's help to sign up before writing a line", async () => {
    const [guest, step] = await Promise.all([useGuestOutOfHelp(), createExplanation()]);

    await Promise.all([
      learningProfileFixture({ birthMonth: 5, birthYear: 1990, userId: guest.id }),
      shareFact(guest.id),
    ]);

    await expect(getStepExampleLine({ stepId: step.id })).resolves.toStrictEqual(GUEST_OUT_OF_HELP);
    expect(generateExampleLines).not.toHaveBeenCalled();
  });

  it("writes the line from every kind of fact the learner shared and their goal, then reuses it", async () => {
    const learner = await createLearner();
    const step = await createExplanation();

    const [used] = await Promise.all([
      shareFact(learner.id),
      memoryFactFixture({ category: "context", statement: "Lives in Recife", userId: learner.id }),
      memoryFactFixture({
        category: "background",
        sensitive: true,
        statement: "Has asthma",
        userId: learner.id,
      }),
      memoryFactFixture({
        category: "routine",
        statement: "Takes the bus to work every morning",
        userId: learner.id,
      }),
      memoryFactFixture({ category: "goals", statement: "Saving for a car", userId: learner.id }),
      memoryFactFixture({
        category: "learning",
        statement: "Understands faster with numbers",
        userId: learner.id,
      }),
      memoryFactFixture({
        category: "preferences",
        statement: "Likes examples about football",
        userId: learner.id,
      }),
      memoryFactFixture({
        category: "preferences",
        statement: "Old fact",
        status: "superseded",
        userId: learner.id,
      }),
      goalFixture({ title: "Pass the ENEM", userId: learner.id }).then((goal) =>
        learningProfileFixture({ activeGoalId: goal.id, userId: learner.id }),
      ),
    ]);

    mockLines(["Na farmácia, 25% de desconto numa caixa de R$ 40 poupa R$ 10."]);

    const first = await getStepExampleLine({ stepId: step.id });
    const second = await getStepExampleLine({ stepId: step.id });

    expect(first).toStrictEqual({
      line: "Na farmácia, 25% de desconto numa caixa de R$ 40 poupa R$ 10.",
      status: "ready",
    });

    expect(second).toStrictEqual(first);

    expect(generateExampleLines).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ goal: "Pass the ENEM", language: "pt", screens: [discountScreen] }),
    );

    // Every kind of fact, routine included, but never a sensitive or superseded one.
    expect(vi.mocked(generateExampleLines).mock.calls[0]?.[0].facts.toSorted()).toStrictEqual([
      "Likes examples about football",
      "Lives in Recife",
      "Saving for a car",
      "Takes the bus to work every morning",
      "Understands faster with numbers",
      "Works at a pharmacy",
    ]);

    const fact = await prisma.memoryFact.findUniqueOrThrow({ where: { id: used.id } });
    expect(fact.lastUsedAt).toBeInstanceOf(Date);
  });

  it("writes every slot of a lesson in one call, even when its screens are asked at once", async () => {
    const learner = await createLearner();
    const { check, discount, interest, plain } = await createTwoSlotLesson();
    await shareFact(learner.id);

    mockLines([
      "Na farmácia, 25% de desconto numa caixa de R$ 40 poupa R$ 10.",
      "Se você parcelar um celular de R$ 1.000 em 10 vezes de R$ 110, paga R$ 100 de juros.",
    ]);

    // The player can ask for two screens of a lesson before either line is written.
    const [onDiscount, onInterest] = await Promise.all([
      getStepExampleLine({ stepId: discount.id }),
      getStepExampleLine({ stepId: interest.id }),
    ]);

    expect(onDiscount).toStrictEqual({
      line: "Na farmácia, 25% de desconto numa caixa de R$ 40 poupa R$ 10.",
      status: "ready",
    });

    expect(onInterest).toStrictEqual({
      line: "Se você parcelar um celular de R$ 1.000 em 10 vezes de R$ 110, paga R$ 100 de juros.",
      status: "ready",
    });

    expect(generateExampleLines).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ screens: [discountScreen, interestScreen] }),
    );

    // Asked again, every screen reads what's stored: no new call.
    await expect(getStepExampleLine({ stepId: interest.id })).resolves.toStrictEqual(onInterest);

    await expect(getStepExampleLine({ stepId: plain.id })).resolves.toStrictEqual({
      line: null,
      status: "ready",
    });

    expect(generateExampleLines).toHaveBeenCalledOnce();

    // A slot left on a screen that isn't an explanation gets no line.
    await expect(getStepExampleLine({ stepId: check.id })).resolves.toStrictEqual({
      status: "notFound",
    });
  });

  it("writes the lesson's lines again when what the learner shared changes", async () => {
    const learner = await createLearner();
    const { discount, interest } = await createTwoSlotLesson();
    await shareFact(learner.id);

    mockLines(["Na farmácia, 25% de desconto numa caixa de R$ 40 poupa R$ 10.", null]);
    await getStepExampleLine({ stepId: discount.id });

    await shareFact(learner.id, "Moved to Toronto");

    mockLines([
      "Em Toronto, 25% off num casaco de 80 dólares poupa 20.",
      "Se você parcelar uma bicicleta de 1.000 dólares em Toronto, os juros somam 100.",
    ]);

    await expect(getStepExampleLine({ stepId: interest.id })).resolves.toStrictEqual({
      line: "Se você parcelar uma bicicleta de 1.000 dólares em Toronto, os juros somam 100.",
      status: "ready",
    });

    await expect(getStepExampleLine({ stepId: discount.id })).resolves.toStrictEqual({
      line: "Em Toronto, 25% off num casaco de 80 dólares poupa 20.",
      status: "ready",
    });

    expect(generateExampleLines).toHaveBeenCalledTimes(2);

    expect(generateExampleLines).toHaveBeenLastCalledWith(
      expect.objectContaining({
        facts: expect.arrayContaining(["Moved to Toronto", "Works at a pharmacy"]),
        screens: [discountScreen, interestScreen],
      }),
    );

    await expect(
      prisma.stepExampleLine.count({
        where: { stepId: { in: [discount.id, interest.id] }, userId: learner.id },
      }),
    ).resolves.toBe(2);
  });

  it("hands the model this lesson's lines first, then the learner's latest from other lessons", async () => {
    const learner = await createLearner();
    await shareFact(learner.id);

    const [older, newer] = await Promise.all([createExplanation(), createExplanation()]);

    mockLines(["Na farmácia, um desconto de 10% numa caixa de R$ 30 tira R$ 3."]);
    await getStepExampleLine({ stepId: older.id });
    mockLines(["No caixa da farmácia, o troco de R$ 50 por R$ 38 é R$ 12."]);
    await getStepExampleLine({ stepId: newer.id });

    // A lesson whose discount screen already has its line, and whose interest screen doesn't yet.
    const current = await libraryLessonFixture({ contentStatus: "completed", language: "pt" });
    const discount = await libraryStepFixture({ content: slotContent, lessonId: current.id });
    mockLines(["Na farmácia, 25% de desconto numa caixa de R$ 40 poupa R$ 10."]);
    await getStepExampleLine({ stepId: discount.id });

    const interest = await libraryStepFixture({ content: interestContent, lessonId: current.id });
    mockLines([null]);

    await expect(getStepExampleLine({ stepId: interest.id })).resolves.toStrictEqual({
      line: null,
      status: "ready",
    });

    expect(generateExampleLines).toHaveBeenLastCalledWith(
      expect.objectContaining({
        earlierLines: [
          "Na farmácia, 25% de desconto numa caixa de R$ 40 poupa R$ 10.",
          "No caixa da farmácia, o troco de R$ 50 por R$ 38 é R$ 12.",
          "Na farmácia, um desconto de 10% numa caixa de R$ 30 tira R$ 3.",
        ],
        screens: [interestScreen],
      }),
    );

    // The discount screen keeps the line the learner already read.
    await expect(getStepExampleLine({ stepId: discount.id })).resolves.toStrictEqual({
      line: "Na farmácia, 25% de desconto numa caixa de R$ 40 poupa R$ 10.",
      status: "ready",
    });
  });

  it("writes nothing for a minor until they turn memory on, then only from goals and learning", async () => {
    const learner = await userFixture();
    mockSession(learner.id);
    const step = await createExplanation();

    await Promise.all([
      shareFact(learner.id),
      memoryFactFixture({
        category: "goals",
        statement: "Wants to become a vet",
        userId: learner.id,
      }),
      goalFixture({ title: "Pass the ENEM", userId: learner.id }).then((goal) =>
        learningProfileFixture({
          activeGoalId: goal.id,
          birthMonth: 1,
          birthYear: new Date().getUTCFullYear() - 15,
          userId: learner.id,
        }),
      ),
    ]);

    // Memory starts off for a teen: nothing they shared reaches the model.
    await expect(getStepExampleLine({ stepId: step.id })).resolves.toStrictEqual({
      line: null,
      status: "ready",
    });

    expect(generateExampleLines).not.toHaveBeenCalled();

    // Turned on, their memory still keeps no life outside learning: the background fact stays out.
    await learningProfileFixture({ memoryEnabled: true, userId: learner.id });

    mockLines(["Numa clínica veterinária, 25% de desconto numa ração de R$ 80 tira R$ 20."]);
    await getStepExampleLine({ stepId: step.id });

    expect(generateExampleLines).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ facts: ["Wants to become a vet"] }),
    );
  });

  it("uses no facts when the learner turned memory off", async () => {
    const learner = await createLearner();
    const step = await createExplanation();

    await Promise.all([
      shareFact(learner.id),
      learningProfileFixture({ memoryEnabled: false, userId: learner.id }),
    ]);

    await expect(getStepExampleLine({ stepId: step.id })).resolves.toStrictEqual({
      line: null,
      status: "ready",
    });

    expect(generateExampleLines).not.toHaveBeenCalled();
  });
});
