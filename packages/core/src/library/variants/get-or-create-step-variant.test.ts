import { randomUUID } from "node:crypto";
import { type WrittenVariant, generateStepVariant } from "@zoonk/ai/tasks/variants/step-variant";
import { type StepKind, prisma } from "@zoonk/db";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { libraryStepFixture, stepVariantFixture } from "@zoonk/testing/fixtures/library-steps";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { revalidateTag } from "next/cache";
import { describe, expect, it, vi } from "vitest";
import { getOrCreateStepVariant } from "./get-or-create-step-variant";

const original = {
  exampleLineSlot: { idea: "A discount on something the learner buys." },
  image: { alt: "A price tag cut by a quarter.", prompt: "A price tag." },
  text: "A 25% discount takes a quarter off the price.",
  title: "Discounts",
};

function mockVariant(data: WrittenVariant, wait?: Promise<unknown>) {
  vi.mocked(generateStepVariant).mockImplementationOnce(async () => {
    await wait;

    return {
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
    };
  });
}

const version: WrittenVariant = {
  exampleLineIdea: "Ignored: the original's slot stays.",
  explore: null,
  image: null,
  kind: "explanation",
  text: "On a ward, 25% off a R$ 40 box of gloves saves R$ 10.",
  title: "A quarter off",
  visual: null,
};

const TOOL = { key: "google-sheets", workflowRunId: "test-run" } as const;

async function createStep(attrs: { content?: object; kind?: StepKind } = {}) {
  const lesson = await libraryLessonFixture({ contentStatus: "completed" });
  return libraryStepFixture({ content: original, lessonId: lesson.id, ...attrs });
}

describe(getOrCreateStepVariant, () => {
  it("returns a stored version without a model call", async () => {
    const step = await createStep();

    const stored = await stepVariantFixture({
      content: original,
      key: TOOL.key,
      kind: "tool",
      stepId: step.id,
    });

    await expect(getOrCreateStepVariant({ ...TOOL, stepId: step.id })).resolves.toStrictEqual({
      created: false,
      status: "ready",
      variant: stored,
    });

    expect(generateStepVariant).not.toHaveBeenCalled();
  });

  it("writes a version once, keeping the example-line slot but not the picture, then reuses it", async () => {
    const step = await createStep();
    mockVariant(version);

    const first = await getOrCreateStepVariant({ ...TOOL, stepId: step.id });
    const second = await getOrCreateStepVariant({ ...TOOL, stepId: step.id });

    expect(first).toMatchObject({ created: true, status: "ready" });
    expect(second).toMatchObject({ created: false, status: "ready" });

    expect(first.status === "ready" && first.variant.content).toStrictEqual({
      exampleLineSlot: original.exampleLineSlot,
      text: version.text,
      title: version.title,
    });

    expect(generateStepVariant).toHaveBeenCalledOnce();
  });

  it("expires no cache for a new version, since lessons read their versions fresh", async () => {
    const step = await createStep();
    mockVariant(version);

    await expect(getOrCreateStepVariant({ ...TOOL, stepId: step.id })).resolves.toMatchObject({
      created: true,
      status: "ready",
    });

    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("reserves concurrent runs atomically and ends with one shared row", async () => {
    const step = await createStep();
    const gate = Promise.withResolvers<boolean>();
    mockVariant(version, gate.promise);
    mockVariant({ ...version, text: "On a ward, pay 75 of every 100 reais." }, gate.promise);

    const pending = Promise.all([
      getOrCreateStepVariant({ ...TOOL, stepId: step.id, workflowRunId: "concurrent-a" }),
      getOrCreateStepVariant({ ...TOOL, stepId: step.id, workflowRunId: "concurrent-b" }),
    ]);

    try {
      await vi.waitFor(() => expect(generateStepVariant).toHaveBeenCalledTimes(2));
    } finally {
      gate.resolve(true);
    }

    const results = await pending;

    const summary = await prisma.stepVariantGeneration.findFirstOrThrow({
      where: { stepId: step.id },
    });

    expect(summary.claimedRunIds.toSorted()).toStrictEqual(["concurrent-a", "concurrent-b"]);
    const ids = results.map((result) => result.status === "ready" && result.variant.id);

    expect(new Set(ids).size).toBe(1);
    await expect(prisma.stepVariant.count({ where: { stepId: step.id } })).resolves.toBe(1);
  });

  it("keys tool versions by a slug", async () => {
    const step = await createStep();
    mockVariant(version);

    const result = await getOrCreateStepVariant({
      key: "  Google Sheets ",
      stepId: step.id,
      workflowRunId: randomUUID(),
    });

    expect(result).toMatchObject({
      status: "ready",
      variant: { key: "google-sheets", kind: "tool" },
    });
  });

  it("saves a draft with LaTeX outside math once code puts it in math, without another model call", async () => {
    const step = await createStep();
    mockVariant({ ...version, text: "A glove is 7.02 × 10^{-5} m thick." });

    const result = await getOrCreateStepVariant({ ...TOOL, stepId: step.id });

    expect(result.status === "ready" && result.variant.content).toMatchObject({
      text: "A glove is 7.02 × $10^{-5}$ m thick.",
    });

    expect(generateStepVariant).toHaveBeenCalledOnce();
  });

  it("holds back one candidate per preparation, replays failures and passes problems to the next run", async () => {
    const step = await createStep();
    const filler = { ...version, text: "It's important to note that 25% is a quarter." };
    mockVariant(filler);
    mockVariant(filler);

    const result = await getOrCreateStepVariant({ ...TOOL, stepId: step.id });
    const replay = await getOrCreateStepVariant({ ...TOOL, stepId: step.id });
    expect(replay).toStrictEqual(result);
    expect(generateStepVariant).toHaveBeenCalledOnce();
    await getOrCreateStepVariant({ ...TOOL, stepId: step.id, workflowRunId: "next-preparation" });

    expect(generateStepVariant).toHaveBeenLastCalledWith(
      expect.objectContaining({ problems: expect.arrayContaining([expect.any(String)]) }),
    );

    expect(result).toMatchObject({ status: "failed" });
    expect(generateStepVariant).toHaveBeenCalledTimes(2);
    await expect(prisma.stepVariant.count({ where: { stepId: step.id } })).resolves.toBe(0);
  });

  it("leaves an infrastructure reservation spent without a rejected draft and retries the same run", async () => {
    const step = await createStep();
    vi.mocked(generateStepVariant).mockRejectedValueOnce(new Error("Provider unavailable"));

    await expect(getOrCreateStepVariant({ ...TOOL, stepId: step.id })).rejects.toThrow(
      "Provider unavailable",
    );

    await expect(
      prisma.stepVariantGeneration.findFirstOrThrow({ where: { stepId: step.id } }),
    ).resolves.toMatchObject({ claimedRunIds: [TOOL.workflowRunId], heldBackDrafts: [] });

    mockVariant(version);

    await expect(getOrCreateStepVariant({ ...TOOL, stepId: step.id })).resolves.toMatchObject({
      status: "ready",
    });

    await expect(
      prisma.stepVariantGeneration.findFirstOrThrow({ where: { stepId: step.id } }),
    ).resolves.toMatchObject({ claimedRunIds: [TOOL.workflowRunId], heldBackDrafts: [] });
  });

  it("does not write a held-back private tool again in the next preparation", async () => {
    const user = await userFixture();
    const lesson = await libraryLessonFixture({ contentStatus: "completed", ownerId: user.id });
    const step = await libraryStepFixture({ content: original, lessonId: lesson.id });
    mockVariant({ ...version, text: "It's important to note that 25% is a quarter." });

    await expect(getOrCreateStepVariant({ ...TOOL, stepId: step.id })).resolves.toMatchObject({
      status: "failed",
    });

    await expect(
      getOrCreateStepVariant({ ...TOOL, stepId: step.id, workflowRunId: "next-preparation" }),
    ).resolves.toStrictEqual({ status: "exhausted" });

    expect(generateStepVariant).toHaveBeenCalledOnce();
  });

  it("has no versions for screens that don't support them, or without a tool", async () => {
    const summary = await createStep({
      content: { ideas: [{ text: "A 25% discount takes a quarter off." }] },
      kind: "summary",
    });

    await expect(getOrCreateStepVariant({ ...TOOL, stepId: summary.id })).resolves.toStrictEqual({
      status: "unsupported",
    });

    const step = await createStep();

    await expect(
      getOrCreateStepVariant({ key: "!!", stepId: step.id, workflowRunId: randomUUID() }),
    ).resolves.toStrictEqual({ status: "unsupported" });

    expect(generateStepVariant).not.toHaveBeenCalled();
  });

  it("finds nothing for unknown steps or lessons that aren't published", async () => {
    const draftLesson = await libraryLessonFixture();
    const step = await libraryStepFixture({ content: original, lessonId: draftLesson.id });

    await expect(getOrCreateStepVariant({ ...TOOL, stepId: step.id })).resolves.toStrictEqual({
      status: "notFound",
    });

    await expect(getOrCreateStepVariant({ ...TOOL, stepId: "not-a-uuid" })).resolves.toStrictEqual({
      status: "notFound",
    });
  });
});
