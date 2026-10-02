import { randomUUID } from "node:crypto";
import { generateExampleLine } from "@zoonk/ai/tasks/v2/variants/example-line";
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

/** The model call is the external boundary; memory reads and the cache run for real. */
vi.mock("@zoonk/ai/tasks/v2/variants/example-line", () => ({ generateExampleLine: vi.fn() }));

const slotContent = {
  exampleLineSlot: { idea: "A discount on something the learner buys." },
  text: "A 25% discount takes a quarter off the price.",
  title: "Discounts",
};

function mockLine(line: string | null) {
  vi.mocked(generateExampleLine).mockResolvedValueOnce({
    data: { line },
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

/** An adult, since minors' and unknown ages' memory keeps no background or preferences. */
async function createLearner() {
  const learner = await userFixture();
  await learningProfileFixture({ birthMonth: 5, birthYear: 1990, userId: learner.id });
  mockSession(learner.id);
  return learner;
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

    await memoryFactFixture({
      category: "background",
      statement: "Works at a pharmacy",
      userId: learner.id,
    });

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

    expect(generateExampleLine).not.toHaveBeenCalled();
  });

  it("asks a guest who used today's help to sign up before writing a line", async () => {
    const [guest, step] = await Promise.all([useGuestOutOfHelp(), createExplanation()]);

    await Promise.all([
      learningProfileFixture({ birthMonth: 5, birthYear: 1990, userId: guest.id }),
      memoryFactFixture({
        category: "background",
        statement: "Works at a pharmacy",
        userId: guest.id,
      }),
    ]);

    await expect(getStepExampleLine({ stepId: step.id })).resolves.toStrictEqual(GUEST_OUT_OF_HELP);
    expect(generateExampleLine).not.toHaveBeenCalled();
  });

  it("writes the line from shared background, preferences and goal, then reuses it", async () => {
    const learner = await createLearner();
    const step = await createExplanation();

    const [used] = await Promise.all([
      memoryFactFixture({
        category: "background",
        statement: "Works at a pharmacy",
        userId: learner.id,
      }),
      memoryFactFixture({
        category: "background",
        sensitive: true,
        statement: "Has asthma",
        userId: learner.id,
      }),
      memoryFactFixture({ category: "routine", statement: "Studies at night", userId: learner.id }),
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

    mockLine("Na farmácia, 25% de desconto numa caixa de R$ 40 poupa R$ 10.");

    const first = await getStepExampleLine({ stepId: step.id });
    const second = await getStepExampleLine({ stepId: step.id });

    expect(first).toStrictEqual({
      line: "Na farmácia, 25% de desconto numa caixa de R$ 40 poupa R$ 10.",
      status: "ready",
    });

    expect(second).toStrictEqual(first);

    expect(generateExampleLine).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        facts: ["Works at a pharmacy"],
        goal: "Pass the ENEM",
        idea: slotContent.exampleLineSlot.idea,
        language: "pt",
      }),
    );

    const fact = await prisma.memoryFact.findUniqueOrThrow({ where: { id: used.id } });
    expect(fact.lastUsedAt).toBeInstanceOf(Date);
  });

  it("writes the line again when what the learner shared changes", async () => {
    const learner = await createLearner();
    const step = await createExplanation();

    await memoryFactFixture({
      category: "background",
      statement: "Works at a pharmacy",
      userId: learner.id,
    });

    mockLine(null);
    await getStepExampleLine({ stepId: step.id });

    await memoryFactFixture({
      category: "background",
      statement: "Moved to Toronto",
      userId: learner.id,
    });

    mockLine("Em Toronto, 25% off num casaco de 80 dólares poupa 20.");

    await expect(getStepExampleLine({ stepId: step.id })).resolves.toStrictEqual({
      line: "Em Toronto, 25% off num casaco de 80 dólares poupa 20.",
      status: "ready",
    });

    await expect(
      prisma.stepExampleLine.count({ where: { stepId: step.id, userId: learner.id } }),
    ).resolves.toBe(1);
  });

  it("uses no background facts for learners who haven't said they're adults", async () => {
    const learner = await userFixture();
    mockSession(learner.id);
    const step = await createExplanation();

    await Promise.all([
      memoryFactFixture({
        category: "background",
        statement: "Works at a pharmacy",
        userId: learner.id,
      }),
      goalFixture({ title: "Pass the ENEM", userId: learner.id }).then((goal) =>
        learningProfileFixture({ activeGoalId: goal.id, userId: learner.id }),
      ),
    ]);

    mockLine("No ENEM, 25% de desconto numa inscrição de R$ 80 poupa R$ 20.");
    await getStepExampleLine({ stepId: step.id });

    expect(generateExampleLine).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ facts: [], goal: "Pass the ENEM" }),
    );
  });

  it("uses no facts when the learner turned memory off", async () => {
    const learner = await createLearner();
    const step = await createExplanation();

    await Promise.all([
      memoryFactFixture({
        category: "background",
        statement: "Works at a pharmacy",
        userId: learner.id,
      }),
      learningProfileFixture({ memoryEnabled: false, userId: learner.id }),
    ]);

    await expect(getStepExampleLine({ stepId: step.id })).resolves.toStrictEqual({
      line: null,
      status: "ready",
    });

    expect(generateExampleLine).not.toHaveBeenCalled();
  });
});
