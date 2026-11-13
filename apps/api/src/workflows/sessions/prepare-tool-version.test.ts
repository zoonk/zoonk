import { randomUUID } from "node:crypto";
import { generateStepVariant } from "@zoonk/ai/tasks/variants/step-variant";
import { prisma } from "@zoonk/db";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { describe, expect, it, vi } from "vitest";
import { createHook } from "workflow";
import { taskResult } from "../_test-utils/recorded-outputs";
import { prepareToolVersion } from "./prepare-tool-version";

function holdTokensLikeTheWorld() {
  const held = new Set<string>();

  vi.mocked(createHook).mockImplementation((options) => {
    const token = options?.token ?? "generated-token";
    const taken = held.has(token);
    held.add(token);

    const release = () => {
      if (!taken) {
        held.delete(token);
      }
    };

    return {
      [Symbol.dispose]: release,
      dispose: release,
      getConflict: () =>
        Promise.resolve(taken ? { returnValue: Promise.resolve(null), runId: "holder" } : null),
      token,
    } as unknown as ReturnType<typeof createHook>;
  });
}

describe(prepareToolVersion, () => {
  it("pays for one draft when several preparations reach the same screen and tool at once", async () => {
    const { steps } = await playableLessonFixture({ steps: ["explanation"] });
    const stepId = steps[0]?.id ?? "";
    const gate = Promise.withResolvers<null>();

    holdTokensLikeTheWorld();

    vi.mocked(generateStepVariant).mockImplementation(async () => {
      await gate.promise;

      return taskResult({
        exampleLineIdea: null,
        explore: null,
        image: null,
        kind: "explanation" as const,
        text: "Type `=SUM(B2:B9)` in the cell under the column to add it up.",
        title: "Adding a column",
        visual: null,
      });
    });

    const settled: string[] = [];

    const pending = Promise.all(
      [
        "Google Sheets",
        "google-sheets",
        "Google Sheets",
        "google sheets",
        "Google Sheets",
        "GOOGLE SHEETS",
      ].map(async (label) => {
        const status = await prepareToolVersion({
          target: { key: label, label, ownerId: null, stepId },
          workflowRunId: randomUUID(),
        });

        settled.push(status);
        return status;
      }),
    );

    await vi.waitFor(() =>
      expect(settled.length + vi.mocked(generateStepVariant).mock.calls.length).toBe(6),
    );

    gate.resolve(null);

    const statuses = await pending;

    expect(statuses.toSorted()).toStrictEqual(["busy", "busy", "busy", "busy", "busy", "ready"]);

    expect(generateStepVariant).toHaveBeenCalledOnce();
    await expect(prisma.stepVariant.count({ where: { stepId } })).resolves.toBe(1);
  });
});
