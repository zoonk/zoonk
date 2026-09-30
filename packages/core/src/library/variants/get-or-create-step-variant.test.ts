import { randomUUID } from "node:crypto";
import { type WrittenVariant, generateStepVariant } from "@zoonk/ai/tasks/v2/variants/step-variant";
import { type StepKind, prisma } from "@zoonk/db";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { libraryStepFixture, stepVariantFixture } from "@zoonk/testing/fixtures/library-steps";
import { revalidateTag } from "next/cache";
import { describe, expect, it, vi } from "vitest";
import { getOrCreateStepVariant } from "./get-or-create-step-variant";
import type * as StepVariantTask from "@zoonk/ai/tasks/v2/variants/step-variant";

/** The model call is the external boundary; conversion, checks and the unique row run for real. */
vi.mock("@zoonk/ai/tasks/v2/variants/step-variant", async (importOriginal) => ({
  ...(await importOriginal<typeof StepVariantTask>()),
  generateStepVariant: vi.fn(),
}));

const original = {
  exampleLineSlot: { idea: "A discount on something the learner buys." },
  image: { alt: "A price tag cut by a quarter.", prompt: "A price tag." },
  text: "A 25% discount takes a quarter off the price.",
  title: "Discounts",
};

function mockVariant(data: WrittenVariant) {
  vi.mocked(generateStepVariant).mockResolvedValueOnce({
    data,
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

const simpler: WrittenVariant = {
  exampleLineIdea: "Ignored: the original's slot stays.",
  image: null,
  kind: "explanation",
  text: "25% off means you pay 3 of every 4 reais.",
  title: "A quarter off",
};

async function createStep(attrs: { content?: object; kind?: StepKind } = {}) {
  const lesson = await libraryLessonFixture({ contentStatus: "completed" });
  return libraryStepFixture({ content: original, lessonId: lesson.id, ...attrs });
}

describe(getOrCreateStepVariant, () => {
  it("returns a stored version without a model call", async () => {
    const step = await createStep();
    const stored = await stepVariantFixture({ content: original, kind: "deeper", stepId: step.id });

    await expect(
      getOrCreateStepVariant({ kind: "deeper", stepId: step.id }),
    ).resolves.toStrictEqual({ created: false, status: "ready", variant: stored });

    expect(generateStepVariant).not.toHaveBeenCalled();
  });

  it("writes a version once, keeping the original's picture and example-line slot, then reuses it", async () => {
    const step = await createStep();
    mockVariant(simpler);

    const first = await getOrCreateStepVariant({ kind: "simpler", stepId: step.id });
    const second = await getOrCreateStepVariant({ kind: "simpler", stepId: step.id });

    expect(first).toMatchObject({ created: true, status: "ready" });
    expect(second).toMatchObject({ created: false, status: "ready" });

    expect(first.status === "ready" && first.variant.content).toStrictEqual({
      exampleLineSlot: original.exampleLineSlot,
      image: original.image,
      text: simpler.text,
      title: simpler.title,
    });

    expect(generateStepVariant).toHaveBeenCalledOnce();
  });

  it("expires no cache for a new version, since lessons read their versions fresh", async () => {
    const step = await createStep();
    mockVariant(simpler);

    await expect(
      getOrCreateStepVariant({ kind: "simpler", stepId: step.id }),
    ).resolves.toMatchObject({ created: true, status: "ready" });

    // Expiring the lesson's tag from a Server Action would re-render the whole lesson page.
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("ends concurrent requests with one shared row", async () => {
    const step = await createStep();
    mockVariant(simpler);
    mockVariant({ ...simpler, text: "Pay 75 of every 100 reais." });

    const results = await Promise.all([
      getOrCreateStepVariant({ kind: "simpler", stepId: step.id }),
      getOrCreateStepVariant({ kind: "simpler", stepId: step.id }),
    ]);

    const ids = results.map((result) => result.status === "ready" && result.variant.id);

    expect(new Set(ids).size).toBe(1);
    await expect(prisma.stepVariant.count({ where: { stepId: step.id } })).resolves.toBe(1);
  });

  it("keys field and tool versions by a slug and drops the picture, since the example changes", async () => {
    const step = await createStep();
    mockVariant({ ...simpler, text: "At the pharmacy, 25% off a R$ 40 box saves R$ 10." });

    const result = await getOrCreateStepVariant({
      key: "  Nursing Homes ",
      kind: "field",
      stepId: step.id,
    });

    expect(result).toMatchObject({ status: "ready", variant: { key: "nursing-homes" } });
    expect(result.status === "ready" && result.variant.content).not.toHaveProperty("image");
  });

  it("tries once more when a draft fails the checks, then gives up", async () => {
    const step = await createStep();
    const filler = { ...simpler, text: "It's important to note that 25% is a quarter." };
    mockVariant(filler);
    mockVariant(filler);

    const result = await getOrCreateStepVariant({ kind: "simpler", stepId: step.id });

    expect(result).toMatchObject({ status: "failed" });
    expect(generateStepVariant).toHaveBeenCalledTimes(2);
    await expect(prisma.stepVariant.count({ where: { stepId: step.id } })).resolves.toBe(0);
  });

  it("has no versions for screens that don't support them", async () => {
    const check = await createStep({
      content: {
        options: [
          { id: "a", isCorrect: true, reason: "Right.", text: "R$ 30" },
          { id: "b", isCorrect: false, reason: "That's the discount.", text: "R$ 10" },
        ],
        question: "What do you pay?",
      },
      kind: "check",
    });

    await expect(
      getOrCreateStepVariant({ kind: "simpler", stepId: check.id }),
    ).resolves.toStrictEqual({ status: "unsupported" });

    await expect(
      getOrCreateStepVariant({ key: "!!", kind: "tool", stepId: check.id }),
    ).resolves.toStrictEqual({ status: "unsupported" });

    expect(generateStepVariant).not.toHaveBeenCalled();
  });

  it("finds nothing for unknown steps or lessons that aren't published", async () => {
    const draftLesson = await libraryLessonFixture();
    const step = await libraryStepFixture({ content: original, lessonId: draftLesson.id });

    await expect(
      getOrCreateStepVariant({ kind: "simpler", stepId: step.id }),
    ).resolves.toStrictEqual({ status: "notFound" });

    await expect(
      getOrCreateStepVariant({ kind: "simpler", stepId: "not-a-uuid" }),
    ).resolves.toStrictEqual({ status: "notFound" });
  });
});
