import { randomUUID } from "node:crypto";
import { assembleChallengeCase, draftEmptyScript } from "@zoonk/ai/tasks/challenge/assemble";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { describe, expect, it } from "vitest";
import { challengePlanFixture } from "../../../../ai/src/tasks/challenge/challenge-plan-fixture";
import { readStepVariantGenerationSummary } from "../variants/variant-generation";
import { checkWrittenChallenge } from "./challenge-case-content";
import { finishFieldChallengeDraft, prepareFieldChallengeDraft } from "./field-challenge";
import { getFieldChallengeToken } from "./field-challenge-token";

async function step() {
  const { steps } = await playableLessonFixture({
    lesson: {
      spec: { kind: "challenge", skills: [{ description: null, name: "Chance" }], variant: "work" },
    },
    steps: ["challenge"],
  });

  return steps[0]?.id ?? "";
}

function scripted() {
  const plan = challengePlanFixture();
  const { written } = assembleChallengeCase({ plan, script: draftEmptyScript(plan) });

  return {
    ...checkWrittenChallenge({ variant: "work", written }),
    provenance: {
      generatedAt: new Date().toISOString(),
      latencyMs: 0,
      model: "openai/gpt-6.1-sol",
      promptVersion: "test",
      provider: "openai",
      requestedModel: "openai/gpt-6.1-sol",
      runId: randomUUID(),
      usage: {},
    },
    summary: { ideas: [], shape: "hub" as const },
    writerModels: ["openai/gpt-6.1-sol"],
  };
}

describe("field challenge admission", () => {
  it("normalizes tokens and reservation keys, then replays published content", async () => {
    const stepId = await step();
    const input = { field: "Nursing", stepId, workflowRunId: randomUUID() };

    expect(getFieldChallengeToken(input)).toBe(
      getFieldChallengeToken({ ...input, field: "nursing" }),
    );

    await expect(prepareFieldChallengeDraft(input)).resolves.toMatchObject({
      params: { field: "nursing" },
      status: "challengeDraft",
    });

    await expect(
      finishFieldChallengeDraft({
        ...input,
        model: "openai/gpt-6.1-sol",
        problems: [],
        scripted: scripted(),
      }),
    ).resolves.toMatchObject({ created: true, status: "ready" });

    await expect(prepareFieldChallengeDraft(input)).resolves.toMatchObject({ status: "ready" });
  });

  it("records one rejection per preparation, sends earlier problems, and exhausts after three", async () => {
    const stepId = await step();
    const input = { field: "retail", stepId, workflowRunId: randomUUID() };
    await prepareFieldChallengeDraft(input);

    await finishFieldChallengeDraft({
      ...input,
      model: "openai/gpt-6.1-sol",
      problems: ["Wrong result"],
    });

    await expect(prepareFieldChallengeDraft(input)).resolves.toMatchObject({ status: "heldBack" });

    await Promise.all(
      [randomUUID(), randomUUID()].map(async (run) => {
        const next = { ...input, workflowRunId: run };

        await expect(prepareFieldChallengeDraft(next)).resolves.toMatchObject({
          params: { problems: expect.arrayContaining(["Wrong result"]) },
          status: "challengeDraft",
        });

        await finishFieldChallengeDraft({
          ...next,
          model: "openai/gpt-6.1-sol",
          problems: ["Wrong result"],
        });
      }),
    );

    await expect(
      prepareFieldChallengeDraft({ ...input, workflowRunId: randomUUID() }),
    ).resolves.toMatchObject({ status: "exhausted" });

    const summary = await readStepVariantGenerationSummary({
      key: "retail",
      kind: "field",
      stepId,
    });

    expect(summary?.heldBackDrafts).toHaveLength(3);
    expect(summary?.variant).toBeNull();
  });
});
