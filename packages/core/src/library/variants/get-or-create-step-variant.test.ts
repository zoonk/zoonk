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

const nursing: WrittenVariant = {
  exampleLineIdea: "Ignored: the original's slot stays.",
  image: null,
  kind: "explanation",
  text: "On a ward, 25% off a R$ 40 box of gloves saves R$ 10.",
  title: "A quarter off",
  visual: null,
};

const FIELD = { key: "nursing", kind: "field" } as const;

async function createStep(attrs: { content?: object; kind?: StepKind } = {}) {
  const lesson = await libraryLessonFixture({ contentStatus: "completed" });
  return libraryStepFixture({ content: original, lessonId: lesson.id, ...attrs });
}

describe(getOrCreateStepVariant, () => {
  it("returns a stored version without a model call", async () => {
    const step = await createStep();
    const stored = await stepVariantFixture({ content: original, ...FIELD, stepId: step.id });

    await expect(getOrCreateStepVariant({ ...FIELD, stepId: step.id })).resolves.toStrictEqual({
      created: false,
      status: "ready",
      variant: stored,
    });

    expect(generateStepVariant).not.toHaveBeenCalled();
  });

  it("writes a version once, keeping the example-line slot but not the picture, then reuses it", async () => {
    const step = await createStep();
    mockVariant(nursing);

    const first = await getOrCreateStepVariant({ ...FIELD, stepId: step.id });
    const second = await getOrCreateStepVariant({ ...FIELD, stepId: step.id });

    expect(first).toMatchObject({ created: true, status: "ready" });
    expect(second).toMatchObject({ created: false, status: "ready" });

    // The example changes, so the original's picture may not fit.
    expect(first.status === "ready" && first.variant.content).toStrictEqual({
      exampleLineSlot: original.exampleLineSlot,
      text: nursing.text,
      title: nursing.title,
    });

    expect(generateStepVariant).toHaveBeenCalledOnce();
  });

  it("expires no cache for a new version, since lessons read their versions fresh", async () => {
    const step = await createStep();
    mockVariant(nursing);

    await expect(getOrCreateStepVariant({ ...FIELD, stepId: step.id })).resolves.toMatchObject({
      created: true,
      status: "ready",
    });

    // Expiring the lesson's tag from a Server Action would re-render the whole lesson page.
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("ends concurrent requests with one shared row", async () => {
    const step = await createStep();
    mockVariant(nursing);
    mockVariant({ ...nursing, text: "On a ward, pay 75 of every 100 reais." });

    const results = await Promise.all([
      getOrCreateStepVariant({ ...FIELD, stepId: step.id }),
      getOrCreateStepVariant({ ...FIELD, stepId: step.id }),
    ]);

    const ids = results.map((result) => result.status === "ready" && result.variant.id);

    expect(new Set(ids).size).toBe(1);
    await expect(prisma.stepVariant.count({ where: { stepId: step.id } })).resolves.toBe(1);
  });

  it("keys field and tool versions by a slug", async () => {
    const step = await createStep();
    mockVariant(nursing);

    const result = await getOrCreateStepVariant({
      key: "  Nursing Homes ",
      kind: "field",
      stepId: step.id,
    });

    expect(result).toMatchObject({ status: "ready", variant: { key: "nursing-homes" } });
  });

  it("tries once more when a draft fails the checks, then gives up", async () => {
    const step = await createStep();
    const filler = { ...nursing, text: "It's important to note that 25% is a quarter." };
    mockVariant(filler);
    mockVariant(filler);

    const result = await getOrCreateStepVariant({ ...FIELD, stepId: step.id });

    expect(result).toMatchObject({ status: "failed" });
    expect(generateStepVariant).toHaveBeenCalledTimes(2);
    await expect(prisma.stepVariant.count({ where: { stepId: step.id } })).resolves.toBe(0);
  });

  it("has no versions for screens that don't support them, or without a field or tool", async () => {
    const summary = await createStep({
      content: { ideas: [{ text: "A 25% discount takes a quarter off." }] },
      kind: "summary",
    });

    await expect(getOrCreateStepVariant({ ...FIELD, stepId: summary.id })).resolves.toStrictEqual({
      status: "unsupported",
    });

    const step = await createStep();

    await expect(
      getOrCreateStepVariant({ key: "!!", kind: "tool", stepId: step.id }),
    ).resolves.toStrictEqual({ status: "unsupported" });

    expect(generateStepVariant).not.toHaveBeenCalled();
  });

  it("finds nothing for unknown steps or lessons that aren't published", async () => {
    const draftLesson = await libraryLessonFixture();
    const step = await libraryStepFixture({ content: original, lessonId: draftLesson.id });

    await expect(getOrCreateStepVariant({ ...FIELD, stepId: step.id })).resolves.toStrictEqual({
      status: "notFound",
    });

    await expect(getOrCreateStepVariant({ ...FIELD, stepId: "not-a-uuid" })).resolves.toStrictEqual(
      { status: "notFound" },
    );
  });
});
