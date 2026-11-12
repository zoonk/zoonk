import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { libraryStepFixture, stepVariantFixture } from "@zoonk/testing/fixtures/library-steps";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import {
  holdBackStepVariantDraft,
  readStepVariantGenerationSummary,
  reserveStepVariantGeneration,
} from "./variant-generation";

async function target(ownerId: string | null = null) {
  const lesson = await libraryLessonFixture({ ownerId });
  const step = await libraryStepFixture({ lessonId: lesson.id });
  return { key: "Google Sheets", kind: "tool" as const, stepId: step.id };
}

const problem = { model: "test", problems: [{ problem: "Wrong answer", screen: null }] };

describe("variant generation admission", () => {
  it("atomically records every admitted run without exceeding eight under concurrency", async () => {
    const input = await target();
    const runs = Array.from({ length: 12 }, () => randomUUID());

    const results = await Promise.all(
      runs.map((workflowRunId) => reserveStepVariantGeneration({ ...input, workflowRunId })),
    );

    expect(results.filter((result) => result.status === "reserved")).toHaveLength(8);
    expect(results.filter((result) => result.status === "exhausted")).toHaveLength(4);
    const summary = await readStepVariantGenerationSummary(input);

    expect(summary?.claimedRunIds.toSorted()).toStrictEqual(
      runs.filter((_, index) => results[index]?.status === "reserved").toSorted(),
    );

    expect(summary?.exhausted).toBe(true);
    expect(summary?.heldBackDrafts).toStrictEqual([]);
  });

  it("reuses a reservation across concurrent replays and infrastructure retries", async () => {
    const input = { ...(await target()), workflowRunId: randomUUID() };

    const results = await Promise.all(
      Array.from({ length: 5 }, () => reserveStepVariantGeneration(input)),
    );

    expect(results.every((result) => result.status === "reserved")).toBe(true);

    await expect(readStepVariantGenerationSummary(input)).resolves.toMatchObject({
      claimedRunIds: [input.workflowRunId],
      heldBackDrafts: [],
    });
  });

  it("preserves different rejected runs written concurrently", async () => {
    const input = await target();
    const runs = ["first", "second", "third"];

    await Promise.all(
      runs.map((workflowRunId) => reserveStepVariantGeneration({ ...input, workflowRunId })),
    );

    await Promise.all(
      runs.map((workflowRunId) =>
        holdBackStepVariantDraft({ ...input, ...problem, workflowRunId }),
      ),
    );

    const summary = await readStepVariantGenerationSummary(input);

    expect(summary?.heldBackDrafts.map((draft) => draft.runId).toSorted()).toStrictEqual(
      runs.toSorted(),
    );
  });

  it("normalizes keys while keeping independent kinds and keys", async () => {
    const input = { ...(await target()), workflowRunId: randomUUID() };
    await reserveStepVariantGeneration(input);
    await reserveStepVariantGeneration({ ...input, key: " google-sheets " });
    await reserveStepVariantGeneration({ ...input, kind: "field" });
    await reserveStepVariantGeneration({ ...input, key: "Excel" });

    await expect(
      prisma.stepVariantGeneration.count({ where: { stepId: input.stepId } }),
    ).resolves.toBe(3);
  });

  it.each([false, true])(
    "enforces the lesson owner's draft allowance (private: %s) and appends replayed failures once",
    async (isPrivate) => {
      const owner = isPrivate ? await userFixture() : null;
      const ownerId = owner?.id ?? null;
      const input = await target(ownerId);
      const limit = isPrivate ? 1 : 3;

      for (const index of Array.from({ length: limit }, (_, i) => i)) {
        const attempt = { ...input, workflowRunId: `run-${index}` };
        // oxlint-disable-next-line no-await-in-loop -- Each run follows the preceding rejection.
        await expect(reserveStepVariantGeneration(attempt)).resolves.toMatchObject({
          status: "reserved",
        });
        // oxlint-disable-next-line no-await-in-loop -- Concurrent replay writes must append only one draft.
        const drafts = await Promise.all(
          Array.from({ length: 3 }, () => holdBackStepVariantDraft({ ...attempt, ...problem })),
        );

        expect(drafts.every((draft) => draft.runId === attempt.workflowRunId)).toBe(true);
      }

      await expect(
        reserveStepVariantGeneration({ ...input, workflowRunId: "over-limit" }),
      ).resolves.toStrictEqual({ status: "exhausted" });

      await expect(
        reserveStepVariantGeneration({ ...input, workflowRunId: "run-0" }),
      ).resolves.toMatchObject({ draft: { runId: "run-0" }, status: "heldBack" });

      const summary = await readStepVariantGenerationSummary(input);
      expect(summary?.heldBackDrafts).toHaveLength(limit);
    },
  );

  it("refuses paid work when a playable variant exists", async () => {
    const input = await target();
    const variant = await stepVariantFixture({ ...input, content: {}, key: "google-sheets" });

    await expect(
      reserveStepVariantGeneration({ ...input, workflowRunId: randomUUID() }),
    ).resolves.toStrictEqual({ status: "ready", variant });

    const summary = await readStepVariantGenerationSummary(input);
    expect(summary?.claimedRunIds).toStrictEqual([]);
  });
});
